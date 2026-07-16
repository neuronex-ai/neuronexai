/**
 * asaas-webhook
 *
 * Receives and processes webhooks from Asaas.
 * Auth: validates `asaas-access-token` header against ASAAS_WEBHOOK_TOKEN env var.
 *
 * Asaas sends at-least-once delivery — must handle duplicates.
 *
 * Key events:
 *   PAYMENT_RECEIVED / PAYMENT_CONFIRMED — mark payment as paid
 *   PAYMENT_OVERDUE — mark payment as expired
 *   PAYMENT_REFUNDED / PAYMENT_REFUND_IN_PROGRESS — handle refunds
 *   PAYMENT_DELETED — mark payment as canceled
 *   TRANSFER_CREATED / TRANSFER_DONE / TRANSFER_FAILED — payouts
 *
 * POST /asaas-webhook  (no auth JWT — validated by webhook token)
 */

import {
    supabaseAdmin,
    corsResponse,
    jsonResponse,
    errorResponse,
    validateAsaasWebhookToken,
    isAsaasEventProcessed,
    persistAsaasEvent,
    markAsaasEventProcessed,
    markAsaasEventFailed,
    getFinancialAccountByAsaasId,
    getFinancialAccountAsaasApiKey,
    asaasRequest,
    normalizeAsaasAccountStatusPayload,
    syncFinancialAccountFromAsaas,
} from './asaas-client.ts';
import {
    normalizePaymentState,
    refreshOverviewSnapshot,
    upsertAccountMovement,
    upsertPaymentFromProvider,
} from './neurofinance-financial.ts';
import { syncFinancialEntryForPayment } from './financial-management.ts';
import {
    dateInTimeZone,
    normalizeBillPaymentStatus,
} from './asaas-bill-scheduling.ts';
import {
    authorizeAsaasInvoice,
    buildAsaasInvoicePayload,
    createAsaasInvoice,
    persistAsaasInvoiceState,
} from './asaas-nfse.ts';
import {
    accessStateFor,
    markProfilePlan,
    subscriptionMetadata,
} from './subscription-access.ts';

export async function handleAsaasWebhookRequest(req: Request) {
    if (req.method === 'OPTIONS') return corsResponse();

    try {
        // 1. Validate webhook token
        if (!validateAsaasWebhookToken(req)) {
            console.error('[asaas-webhook] Invalid webhook token');
            return errorResponse('Unauthorized', 401);
        }

        const body = await req.json();
        const event = body.event as string;
        const payment = body.payment as any;
        const resource = getWebhookResource(body);

        if (!event) {
            return errorResponse('Missing event type', 400);
        }

        const providerObjectId = resource?.id || 'unknown';
        const providerObjectType = resource?.object || inferProviderObjectType(body);
        const asaasAccountId =
            body?.accountStatus?.id ||
            (typeof body?.account === 'string' ? body.account : body?.account?.id) ||
            resource?.account ||
            null;
        const webhookFinancialAccount = asaasAccountId
            ? await getFinancialAccountByAsaasId(String(asaasAccountId))
            : null;
        const eventId = body.id || `${event}_${providerObjectId}`;

        console.log(`[asaas-webhook] Received: ${event}, objectId: ${providerObjectId}`);

        // 2. Check idempotency using the Asaas event id when available.
        const dedupKey = String(eventId);
        const alreadyProcessed = await isAsaasEventProcessed(dedupKey);
        if (alreadyProcessed) {
            console.log(`[asaas-webhook] Event already processed: ${dedupKey}`);
            return jsonResponse({ received: true, duplicate: true });
        }

        // 3. Persist event
        await persistAsaasEvent(event, dedupKey, body, {
            asaasAccountId,
            providerObjectId,
            providerObjectType,
        });

        // 4. Route to handler
        try {
            switch (event) {
                case 'PAYMENT_RECEIVED':
                case 'PAYMENT_CONFIRMED':
                case 'PAYMENT_AUTHORIZED':
                case 'PAYMENT_ANTICIPATED':
                    if (!(await handlePlatformPaymentEvent(body, payment, event))) {
                        await handlePaymentEvent(payment, event, webhookFinancialAccount);
                    }
                    break;

                case 'PAYMENT_OVERDUE':
                    if (!(await handlePlatformPaymentEvent(body, payment, event))) {
                        await handlePaymentEvent(payment, event, webhookFinancialAccount);
                    }
                    break;

                case 'PAYMENT_REFUNDED':
                case 'PAYMENT_PARTIALLY_REFUNDED':
                case 'PAYMENT_REFUND_IN_PROGRESS':
                case 'PAYMENT_REFUND_DENIED':
                case 'PAYMENT_RECEIVED_IN_CASH_UNDONE':
                    if (!(await handlePlatformPaymentEvent(body, payment, event))) {
                        await handlePaymentEvent(payment, event, webhookFinancialAccount);
                    }
                    break;

                case 'PAYMENT_DELETED':
                case 'PAYMENT_RESTORED':
                    if (!(await handlePlatformPaymentEvent(body, payment, event))) {
                        await handlePaymentEvent(payment, event, webhookFinancialAccount);
                    }
                    break;

                case 'PAYMENT_CREATED':
                case 'PAYMENT_UPDATED':
                case 'PAYMENT_AWAITING_RISK_ANALYSIS':
                case 'PAYMENT_APPROVED_BY_RISK_ANALYSIS':
                case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS':
                case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED':
                case 'PAYMENT_CHARGEBACK_REQUESTED':
                case 'PAYMENT_CHARGEBACK_DISPUTE':
                case 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL':
                case 'PAYMENT_DUNNING_REQUESTED':
                case 'PAYMENT_DUNNING_RECEIVED':
                case 'PAYMENT_BANK_SLIP_CANCELLED':
                case 'PAYMENT_BANK_SLIP_VIEWED':
                case 'PAYMENT_CHECKOUT_VIEWED':
                case 'PAYMENT_SPLIT_CANCELLED':
                case 'PAYMENT_SPLIT_DIVERGENCE_BLOCK':
                case 'PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED':
                    if (!(await handlePlatformPaymentEvent(body, payment, event))) {
                        await handlePaymentEvent(payment, event, webhookFinancialAccount);
                    }
                    break;

                case 'TRANSFER_CREATED':
                case 'TRANSFER_PENDING':
                case 'TRANSFER_IN_BANK_PROCESSING':
                case 'TRANSFER_BLOCKED':
                    await handleTransferPending(body.transfer, event);
                    break;

                case 'TRANSFER_DONE':
                    await handleTransferDone(body.transfer);
                    break;

                case 'TRANSFER_FAILED':
                case 'TRANSFER_CANCELLED':
                    await handleTransferFailed(body.transfer, event);
                    break;

                default:
                    if (event.startsWith('BILL_')) {
                        await handleBillEvent(body.bill || resource, event);
                    } else if (event.startsWith('INVOICE_')) {
                        await handleInvoiceEvent(body.invoice || resource, event, webhookFinancialAccount);
                    } else if (event.startsWith('SUBSCRIPTION_') || event.startsWith('CHECKOUT_')) {
                        await handlePlatformSubscriptionEvent(body, resource, event);
                    } else if (event.startsWith('RECEIVABLE_ANTICIPATION_')) {
                        await handleReceivableAnticipationEvent(body.anticipation || resource, event, webhookFinancialAccount);
                    } else if (event.startsWith('ACCOUNT_STATUS_')) {
                        await handleAccountStatus(body.accountStatus, event);
                    } else if (isGenericNotifiableAsaasEvent(event)) {
                        await handleGenericAsaasEvent(body, resource, event, webhookFinancialAccount);
                    } else {
                        console.log(`[asaas-webhook] Unhandled event: ${event}`);
                    }
            }

            await markAsaasEventProcessed(dedupKey);

        } catch (handlerError: any) {
            console.error(`[asaas-webhook] Handler error for ${event}:`, handlerError);
            await markAsaasEventFailed(dedupKey, handlerError.message);
        }

        // Always return 200 to Asaas to prevent retries on our handled events
        return jsonResponse({ received: true });

    } catch (error: any) {
        console.error('asaas-webhook error:', error);
        return jsonResponse({ received: true, error: error.message }, 200);
    }
}

// ─────────────────────────────────────────────────────────────
// Payment handlers
// ─────────────────────────────────────────────────────────────

function getWebhookResource(body: any) {
    return body?.payment ||
        body?.bill ||
        body?.transfer ||
        body?.accountStatus ||
        body?.subscription ||
        body?.checkout ||
        body?.authorization ||
        body?.paymentInstruction ||
        body?.eligibility ||
        body?.balance ||
        body?.internalTransfer ||
        body?.mobilePhoneRecharge ||
        body?.customer ||
        body?.invoice ||
        body?.pix ||
        body?.anticipation ||
        null;
}

function inferProviderObjectType(body: any) {
    if (body?.payment) return 'payment';
    if (body?.bill) return 'bill';
    if (body?.transfer) return 'transfer';
    if (body?.accountStatus) return 'account_status';
    if (body?.subscription) return 'subscription';
    if (body?.checkout) return 'checkout';
    if (body?.authorization) return 'pix_automatic_authorization';
    if (body?.paymentInstruction) return 'pix_automatic_payment_instruction';
    if (body?.eligibility) return 'pix_automatic_eligibility';
    if (body?.balance) return 'balance';
    if (body?.internalTransfer) return 'internal_transfer';
    if (body?.mobilePhoneRecharge) return 'mobile_phone_recharge';
    if (body?.customer) return 'customer';
    if (body?.invoice) return 'invoice';
    if (body?.pix) return 'pix';
    if (body?.anticipation) return 'anticipation';
    return 'unknown';
}

const ADMIN_ONLY_ASAAS_EVENTS = new Set([
    'ACCESS_TOKEN_CREATED',
    'ACCESS_TOKEN_DELETED',
    'ACCESS_TOKEN_DISABLED',
    'ACCESS_TOKEN_ENABLED',
    'ACCESS_TOKEN_EXPIRED',
    'ACCESS_TOKEN_EXPIRING_SOON',
]);

const HISTORY_ONLY_ASAAS_EVENTS = new Set<string>();

const GENERIC_NOTIFIABLE_PREFIXES = [
    'INVOICE_',
    'SUBSCRIPTION_',
    'CHECKOUT_',
    'BALANCE_',
    'INTERNAL_TRANSFER_',
    'PIX_AUTOMATIC_',
    'MOBILE_PHONE_RECHARGE_',
];

function isGenericNotifiableAsaasEvent(event: string) {
    return GENERIC_NOTIFIABLE_PREFIXES.some((prefix) => event.startsWith(prefix));
}

function compactEventLabel(event: string) {
    return event
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function amountCentsFromResource(resource: any) {
    const raw = resource?.value ??
        resource?.netValue ??
        resource?.grossValue ??
        resource?.amount ??
        resource?.anticipatedValue ??
        resource?.totalValue ??
        0;
    const numberValue = Number(raw || 0);
    return Number.isFinite(numberValue) && numberValue > 0
        ? Math.round(numberValue * 100)
        : null;
}

type AsaasNotificationContext = {
    patientId?: string | null;
    patientName?: string | null;
    eventTimestamp?: string | null;
    eventTimestampLabel?: string | null;
    eventIdSuffix?: string | null;
};

function formatAsaasDateTime(value?: string | null) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(parsed);
}

function paymentViewTimestamp(payment: any, event: string) {
    if (event === 'PAYMENT_BANK_SLIP_VIEWED') {
        return payment?.lastBankSlipViewedDate ||
            payment?.bankSlipViewedDate ||
            payment?.lastInvoiceViewedDate ||
            payment?.dateCreated ||
            null;
    }

    if (event === 'PAYMENT_CHECKOUT_VIEWED') {
        return payment?.lastInvoiceViewedDate ||
            payment?.invoiceViewedDate ||
            payment?.lastBankSlipViewedDate ||
            payment?.dateCreated ||
            null;
    }

    return null;
}

function notificationEventSuffixFromTimestamp(value?: string | null) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().replace(/[^0-9TZ]/g, '');
}

async function recordAppointmentPaymentView(nbPayment: any, payment: any, event: string) {
    if (!nbPayment?.appointment_id) return;
    const eventType = event === 'PAYMENT_BANK_SLIP_VIEWED'
        ? 'boleto_viewed'
        : event === 'PAYMENT_CHECKOUT_VIEWED'
            ? 'charge_viewed'
            : null;
    if (!eventType) return;

    const viewedAt = paymentViewTimestamp(payment, event) || new Date().toISOString();
    const suffix = notificationEventSuffixFromTimestamp(viewedAt) || crypto.randomUUID();
    const { error } = await supabaseAdmin.rpc('record_appointment_communication_event', {
        p_appointment_id: nbPayment.appointment_id,
        p_event_type: eventType,
        p_action_origin: 'neurofinance_asaas',
        p_metadata: {
            provider: 'asaas',
            providerEvent: event,
            providerPaymentId: payment?.id || nbPayment.provider_payment_id || null,
            chargeId: nbPayment.id,
            viewedAt,
        },
        p_idempotency_key: `appointment:${nbPayment.appointment_id}:payment:${nbPayment.id}:${eventType}:${suffix}`,
    });
    if (error) console.warn('[asaas-webhook] Failed to append appointment payment view:', error);
}

async function buildPaymentNotificationContext(nbPayment: any, payment: any, event: string): Promise<AsaasNotificationContext> {
    let patientName: string | null = null;

    if (nbPayment?.patient_id) {
        const { data, error } = await supabaseAdmin
            .from('patients')
            .select('name')
            .eq('id', nbPayment.patient_id)
            .eq('user_id', nbPayment.user_id)
            .maybeSingle();
        if (error) {
            console.warn('[asaas-webhook] Failed to resolve patient name for notification:', error);
        }
        patientName = data?.name || null;
    }

    const eventTimestamp = paymentViewTimestamp(payment, event);

    return {
        patientId: nbPayment?.patient_id || null,
        patientName,
        eventTimestamp,
        eventTimestampLabel: formatAsaasDateTime(eventTimestamp),
        eventIdSuffix: notificationEventSuffixFromTimestamp(eventTimestamp),
    };
}

function asaasNotificationDescriptor(event: string, resource: any, context: AsaasNotificationContext = {}) {
    if (ADMIN_ONLY_ASAAS_EVENTS.has(event) || HISTORY_ONLY_ASAAS_EVENTS.has(event)) return null;

    const amountCents = amountCentsFromResource(resource);
    const amountText = amountCents
        ? ` no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amountCents / 100)}`
        : '';
    const base = {
        title: 'Atualização do NeuroFinance',
        message: `Uma movimentação financeira foi atualizada${amountText}.`,
        severity: 'info',
        priority: 'normal',
        requiresAction: false,
        nativePushEligible: false,
    };
    const patientLabel = context.patientName || 'Paciente';
    const viewedAt = context.eventTimestampLabel ? ` em ${context.eventTimestampLabel}` : '';

    const table: Record<string, Partial<typeof base>> = {
        PAYMENT_AUTHORIZED: { title: 'Pagamento autorizado', message: `Uma cobrança foi autorizada${amountText}.`, severity: 'success' },
        PAYMENT_CREATED: { title: 'Cobrança criada', message: `Uma cobrança foi criada no NeuroFinance${amountText}.` },
        PAYMENT_UPDATED: { title: 'Cobrança atualizada', message: `Uma cobrança foi atualizada no NeuroFinance${amountText}.` },
        PAYMENT_CONFIRMED: { title: 'Pagamento confirmado', message: `Um pagamento foi confirmado${amountText}.`, severity: 'success' },
        PAYMENT_RECEIVED: { title: 'Pagamento recebido', message: `Um pagamento ficou disponível no NeuroFinance${amountText}.`, severity: 'success' },
        PAYMENT_ANTICIPATED: { title: 'Pagamento antecipado', message: `Uma cobrança foi antecipada${amountText}.`, severity: 'success' },
        PAYMENT_OVERDUE: { title: 'Pagamento vencido', message: `Uma cobrança venceu e precisa de acompanhamento${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true, nativePushEligible: true },
        PAYMENT_DELETED: { title: 'Cobrança removida', message: `Uma cobrança foi removida${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        PAYMENT_RESTORED: { title: 'Cobrança restaurada', message: `Uma cobrança foi restaurada${amountText}.`, severity: 'success' },
        PAYMENT_REFUNDED: { title: 'Pagamento estornado', message: `Um pagamento foi estornado${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        PAYMENT_PARTIALLY_REFUNDED: { title: 'Pagamento parcialmente estornado', message: `Um pagamento teve estorno parcial${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        PAYMENT_REFUND_IN_PROGRESS: { title: 'Estorno em processamento', message: `Um estorno está em processamento${amountText}.`, severity: 'info' },
        PAYMENT_REFUND_DENIED: { title: 'Estorno negado', message: `Uma solicitação de estorno não foi aprovada${amountText}.`, severity: 'destructive', priority: 'high', requiresAction: true, nativePushEligible: true },
        PAYMENT_RECEIVED_IN_CASH_UNDONE: { title: 'Baixa em dinheiro desfeita', message: `Uma baixa manual de pagamento foi desfeita${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        PAYMENT_AWAITING_RISK_ANALYSIS: { title: 'Pagamento em análise', message: `Uma cobrança entrou em análise de segurança${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        PAYMENT_APPROVED_BY_RISK_ANALYSIS: { title: 'Análise aprovada', message: `Uma cobrança foi aprovada na análise de segurança${amountText}.`, severity: 'success' },
        PAYMENT_REPROVED_BY_RISK_ANALYSIS: { title: 'Análise não aprovada', message: `Uma cobrança não foi aprovada na análise de segurança${amountText}.`, severity: 'destructive', priority: 'high', requiresAction: true, nativePushEligible: true },
        PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: { title: 'Cartão recusado', message: `O pagamento no cartão foi recusado${amountText}.`, severity: 'destructive', priority: 'high', requiresAction: true, nativePushEligible: true },
        PAYMENT_CHARGEBACK_REQUESTED: { title: 'Contestação solicitada', message: `Uma contestação foi solicitada${amountText}.`, severity: 'destructive', priority: 'urgent', requiresAction: true, nativePushEligible: true },
        PAYMENT_CHARGEBACK_DISPUTE: { title: 'Contestação em análise', message: `Uma contestação entrou em análise${amountText}.`, severity: 'destructive', priority: 'urgent', requiresAction: true, nativePushEligible: true },
        PAYMENT_AWAITING_CHARGEBACK_REVERSAL: { title: 'Contestação aguardando reversão', message: `Uma contestação aguarda reversão${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true, nativePushEligible: true },
        PAYMENT_DUNNING_REQUESTED: { title: 'Recuperação de cobrança solicitada', message: `Uma recuperação de cobrança foi solicitada${amountText}.`, severity: 'info' },
        PAYMENT_DUNNING_RECEIVED: { title: 'Recuperação de cobrança recebida', message: `Uma recuperação de cobrança foi recebida${amountText}.`, severity: 'success' },
        PAYMENT_BANK_SLIP_CANCELLED: { title: 'Boleto cancelado', message: `Um boleto foi cancelado${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        PAYMENT_BANK_SLIP_VIEWED: { title: 'Boleto visualizado', message: `${patientLabel} visualizou o boleto${viewedAt}.`, severity: 'info', priority: 'low' },
        PAYMENT_CHECKOUT_VIEWED: { title: 'Cobrança visualizada', message: `${patientLabel} visualizou a cobrança${viewedAt}.`, severity: 'info', priority: 'low' },
        PAYMENT_SPLIT_CANCELLED: { title: 'Divisão cancelada', message: `A divisão de uma cobrança foi cancelada${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        PAYMENT_SPLIT_DIVERGENCE_BLOCK: { title: 'Divisão bloqueada', message: `Uma divergência na divisão bloqueou uma cobrança${amountText}.`, severity: 'destructive', priority: 'high', requiresAction: true, nativePushEligible: true },
        PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED: { title: 'Divisão regularizada', message: `A divergência na divisão foi resolvida${amountText}.`, severity: 'success' },
        TRANSFER_CREATED: { title: 'Transferência criada', message: `Uma transferência foi criada${amountText}.` },
        TRANSFER_PENDING: { title: 'Transferência pendente', message: `Uma transferência está pendente${amountText}.`, severity: 'info' },
        TRANSFER_IN_BANK_PROCESSING: { title: 'Transferência em processamento', message: `Uma transferência entrou em processamento bancário${amountText}.`, severity: 'info' },
        TRANSFER_DONE: { title: 'Transferência concluída', message: `Uma transferência foi concluída${amountText}.`, severity: 'success' },
        TRANSFER_FAILED: { title: 'Transferência não concluída', message: `Uma transferência não foi concluída${amountText}.`, severity: 'destructive', priority: 'high', requiresAction: true, nativePushEligible: true },
        TRANSFER_CANCELLED: { title: 'Transferência cancelada', message: `Uma transferência foi cancelada${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        TRANSFER_BLOCKED: { title: 'Transferência bloqueada', message: `Uma transferência foi bloqueada por segurança${amountText}.`, severity: 'destructive', priority: 'high', requiresAction: true, nativePushEligible: true },
        BILL_CREATED: { title: 'Conta criada', message: `Um pagamento de conta foi criado${amountText}.` },
        BILL_PENDING: { title: 'Conta pendente', message: `Um pagamento de conta está pendente${amountText}.`, severity: 'info' },
        BILL_BANK_PROCESSING: { title: 'Conta em processamento', message: `Um pagamento de conta entrou em processamento bancário${amountText}.`, severity: 'info' },
        BILL_PAID: { title: 'Conta paga', message: `Um pagamento de conta foi confirmado${amountText}.`, severity: 'success' },
        BILL_FAILED: { title: 'Pagamento de conta falhou', message: `Um pagamento de conta falhou${amountText}.`, severity: 'destructive', priority: 'high', requiresAction: true, nativePushEligible: true },
        BILL_CANCELLED: { title: 'Pagamento de conta cancelado', message: `Um pagamento de conta foi cancelado${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        BILL_REFUNDED: { title: 'Pagamento de conta estornado', message: `Um pagamento de conta foi estornado${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        RECEIVABLE_ANTICIPATION_PENDING: { title: 'Antecipação pendente', message: `Uma antecipação está pendente${amountText}.`, severity: 'info' },
        RECEIVABLE_ANTICIPATION_SCHEDULED: { title: 'Antecipação agendada', message: `Uma antecipação foi agendada${amountText}.`, severity: 'info' },
        RECEIVABLE_ANTICIPATION_CREDITED: { title: 'Antecipação creditada', message: `Uma antecipação foi creditada${amountText}.`, severity: 'success' },
        RECEIVABLE_ANTICIPATION_DEBITED: { title: 'Antecipação debitada', message: `Uma antecipação foi debitada${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        RECEIVABLE_ANTICIPATION_DENIED: { title: 'Antecipação não aprovada', message: `Uma antecipação não foi aprovada${amountText}.`, severity: 'destructive', priority: 'high', requiresAction: true, nativePushEligible: true },
        RECEIVABLE_ANTICIPATION_CANCELLED: { title: 'Antecipação cancelada', message: `Uma antecipação foi cancelada${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        RECEIVABLE_ANTICIPATION_OVERDUE: { title: 'Antecipação vencida', message: `Uma antecipação ficou vencida${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true, nativePushEligible: true },
        INVOICE_CREATED: { title: 'NFS-e criada', message: 'Uma NFS-e foi criada no NeuroFinance.', severity: 'info' },
        INVOICE_UPDATED: { title: 'NFS-e atualizada', message: 'Uma NFS-e foi atualizada no NeuroFinance.', severity: 'info' },
        INVOICE_SYNCHRONIZED: { title: 'NFS-e sincronizada', message: 'Uma NFS-e foi sincronizada com a prefeitura.', severity: 'success' },
        INVOICE_AUTHORIZED: { title: 'Nota fiscal autorizada', message: 'Uma NFS-e foi autorizada.', severity: 'success' },
        INVOICE_PROCESSING_CANCELLATION: { title: 'Cancelamento de NFS-e em processamento', message: 'O cancelamento de uma NFS-e está em processamento.', severity: 'warning', priority: 'high', requiresAction: true },
        INVOICE_CANCELED: { title: 'NFS-e cancelada', message: 'Uma NFS-e foi cancelada.', severity: 'warning', priority: 'high', requiresAction: true },
        INVOICE_ERROR: { title: 'Erro na nota fiscal', message: 'Uma NFS-e precisa de revisão.', severity: 'destructive', priority: 'high', requiresAction: true, nativePushEligible: true },
        INVOICE_CANCELLATION_DENIED: { title: 'Cancelamento de NFS-e não aprovado', message: 'O cancelamento de uma NFS-e não foi aprovado.', severity: 'destructive', priority: 'high', requiresAction: true, nativePushEligible: true },
        SUBSCRIPTION_CREATED: { title: 'Assinatura criada', message: `Uma assinatura foi criada${amountText}.` },
        SUBSCRIPTION_UPDATED: { title: 'Assinatura atualizada', message: `Uma assinatura foi atualizada${amountText}.` },
        SUBSCRIPTION_INACTIVATED: { title: 'Assinatura inativada', message: `Uma assinatura foi inativada${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        SUBSCRIPTION_DELETED: { title: 'Assinatura removida', message: `Uma assinatura foi removida${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK: { title: 'Divisão da assinatura bloqueada', message: 'Uma assinatura foi bloqueada por divergência na divisão.', severity: 'destructive', priority: 'high', requiresAction: true, nativePushEligible: true },
        SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK_FINISHED: { title: 'Divisão da assinatura regularizada', message: 'A divergência na divisão da assinatura foi resolvida.', severity: 'success' },
        SUBSCRIPTION_SPLIT_DISABLED: { title: 'Divisão desativada na assinatura', message: 'A divisão de uma assinatura foi desativada.', severity: 'warning', priority: 'high', requiresAction: true },
        CHECKOUT_CREATED: { title: 'Link de pagamento criado', message: `Um link de pagamento foi criado${amountText}.` },
        CHECKOUT_CANCELED: { title: 'Link de pagamento cancelado', message: `Um link de pagamento foi cancelado${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        CHECKOUT_EXPIRED: { title: 'Link de pagamento expirado', message: `Um link de pagamento expirou${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        CHECKOUT_PAID: { title: 'Link de pagamento recebido', message: `Um link de pagamento foi pago${amountText}.`, severity: 'success' },
        BALANCE_VALUE_BLOCKED: { title: 'Saldo bloqueado', message: `Um valor foi bloqueado no saldo NeuroFinance${amountText}.`, severity: 'destructive', priority: 'high', requiresAction: true, nativePushEligible: true },
        BALANCE_VALUE_UNBLOCKED: { title: 'Saldo desbloqueado', message: `Um valor foi desbloqueado no saldo NeuroFinance${amountText}.`, severity: 'success' },
        INTERNAL_TRANSFER_CREDIT: { title: 'Transferência interna recebida', message: `Uma transferência interna creditou sua conta${amountText}.`, severity: 'success' },
        INTERNAL_TRANSFER_DEBIT: { title: 'Transferência interna enviada', message: `Uma transferência interna debitou sua conta${amountText}.`, severity: 'info' },
        MOBILE_PHONE_RECHARGE_PENDING: { title: 'Recarga pendente', message: `Uma recarga está pendente${amountText}.`, severity: 'info' },
        MOBILE_PHONE_RECHARGE_CANCELLED: { title: 'Recarga cancelada', message: `Uma recarga foi cancelada${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        MOBILE_PHONE_RECHARGE_CONFIRMED: { title: 'Recarga confirmada', message: `Uma recarga foi confirmada${amountText}.`, severity: 'success' },
        MOBILE_PHONE_RECHARGE_REFUNDED: { title: 'Recarga estornada', message: `Uma recarga foi estornada${amountText}.`, severity: 'warning', priority: 'high', requiresAction: true },
        PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CREATED: { title: 'Pix Automático criado', message: 'Uma autorização de Pix Automático foi criada.', severity: 'info' },
        PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED: { title: 'Pix Automático ativado', message: 'Uma autorização de Pix Automático foi ativada.', severity: 'success' },
        PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED: { title: 'Pix Automático cancelado', message: 'Uma autorização de Pix Automático foi cancelada.', severity: 'warning', priority: 'high', requiresAction: true },
        PIX_AUTOMATIC_RECURRING_AUTHORIZATION_EXPIRED: { title: 'Pix Automático expirado', message: 'Uma autorização de Pix Automático expirou.', severity: 'warning', priority: 'high', requiresAction: true },
        PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED: { title: 'Pix Automático recusado', message: 'Uma autorização de Pix Automático foi recusada pelo banco.', severity: 'destructive', priority: 'high', requiresAction: true, nativePushEligible: true },
        PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CREATED: { title: 'Instrução Pix criada', message: 'Uma instrução de pagamento Pix Automático foi criada.', severity: 'info' },
        PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_SCHEDULED: { title: 'Instrução Pix agendada', message: 'Uma instrução de pagamento Pix Automático foi agendada.', severity: 'info' },
        PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED: { title: 'Instrução Pix recusada', message: 'Uma instrução de pagamento Pix Automático foi recusada.', severity: 'destructive', priority: 'high', requiresAction: true, nativePushEligible: true },
        PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CANCELLED: { title: 'Instrução Pix cancelada', message: 'Uma instrução de pagamento Pix Automático foi cancelada.', severity: 'warning', priority: 'high', requiresAction: true },
        PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED: { title: 'Elegibilidade Pix atualizada', message: 'A elegibilidade da conta para Pix Automático foi atualizada.', severity: 'info' },
    };

    const descriptor = { ...base, ...(table[event] || {}) };

    if (event.startsWith('ACCOUNT_STATUS_')) {
        if (event.endsWith('_REJECTED')) {
            return {
                ...descriptor,
                title: 'Cadastro requer atenção',
                message: 'Uma etapa de cadastro da conta NeuroFinance precisa de revisão.',
                severity: 'destructive',
                priority: 'high',
                requiresAction: true,
                nativePushEligible: true,
            };
        }
        if (event.endsWith('_APPROVED')) {
            return {
                ...descriptor,
                title: 'Cadastro aprovado',
                message: 'Uma etapa de cadastro da conta NeuroFinance foi aprovada.',
                severity: 'success',
            };
        }
        if (event.endsWith('_EXPIRING_SOON') || event.endsWith('_EXPIRED')) {
            return {
                ...descriptor,
                title: 'Dados comerciais precisam de revisão',
                message: 'Os dados comerciais da conta NeuroFinance precisam ser revisados.',
                severity: 'warning',
                priority: 'high',
                requiresAction: true,
                nativePushEligible: true,
            };
        }
    }

    return descriptor;
}

async function emitAsaasNotification(args: {
    userId?: string | null;
    financialAccountId?: string | null;
    event: string;
    resource: any;
    objectType: string;
    actionUrl?: string;
    context?: AsaasNotificationContext;
}) {
    if (!args.userId) return;

    const descriptor = asaasNotificationDescriptor(args.event, args.resource, args.context);
    if (!descriptor) return;

    const providerObjectId = String(args.resource?.id || args.resource?.payment || args.resource?.authorization?.id || args.event);
    const amountCents = amountCentsFromResource(args.resource);
    const eventId = `asaas:${args.event}:${providerObjectId}${args.context?.eventIdSuffix ? `:${args.context.eventIdSuffix}` : ''}`;
    const { error } = await supabaseAdmin.rpc('emit_user_notification', {
        p_user_id: args.userId,
        p_event_id: eventId,
        p_type: `asaas_${args.event.toLowerCase()}`,
        p_category: 'financeiro',
        p_severity: descriptor.severity,
        p_title: descriptor.title,
        p_message: descriptor.message,
        p_action_url: args.actionUrl || '/financeiro?view=conta-digital',
        p_priority: descriptor.priority,
        p_data: {
            sourceModule: 'financeiro',
            financeScope: 'neurofinance',
            eventSource: 'asaas_webhook',
            provider: 'asaas',
            asaasEvent: args.event,
            providerObjectId,
            providerObjectType: args.objectType,
            financialAccountId: args.financialAccountId || null,
            subaccountId: args.financialAccountId || null,
            amountCents,
            patientId: args.context?.patientId || null,
            patientName: args.context?.patientName || null,
            eventOccurredAt: args.context?.eventTimestamp || null,
            requiresAction: descriptor.requiresAction,
            nativePushEligible: descriptor.nativePushEligible,
        },
        p_payload: {
            provider: 'asaas',
            objectType: args.objectType,
        },
        p_organization_id: null,
    });

    if (error) {
        console.warn('[asaas-webhook] Failed to emit notification:', error);
    }
}

async function findPaymentByProviderId(paymentId: string, columns = '*'): Promise<any> {
    const { data, error } = await supabaseAdmin
        .from('nb_payments')
        .select(columns)
        .eq('provider_payment_id', paymentId)
        .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const fallback = await supabaseAdmin
        .from('nb_payments')
        .select(columns)
        .filter('metadata->>asaas_payment_id', 'eq', paymentId)
        .maybeSingle();

    if (fallback.error) throw fallback.error;
    return fallback.data;
}

async function findPayoutByProviderId(transferId: string, columns = '*'): Promise<any> {
    const { data, error } = await supabaseAdmin
        .from('nb_payouts')
        .select(columns)
        .eq('provider_payout_id', transferId)
        .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const fallback = await supabaseAdmin
        .from('nb_payouts')
        .select(columns)
        .filter('metadata->>asaas_transfer_id', 'eq', transferId)
        .maybeSingle();

    if (fallback.error) throw fallback.error;
    return fallback.data;
}

async function touchFinancialAccountEvent(
    financialAccountId: string | null | undefined,
    event: string
) {
    if (!financialAccountId) return;

    const { error } = await supabaseAdmin
        .from('financial_accounts')
        .update({
            last_asaas_event_type: event,
            last_asaas_event_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', financialAccountId);

    if (error) console.warn('[asaas-webhook] Failed to touch financial account:', error);
}

function mapAsaasPaymentStatus(status?: string) {
    switch ((status || '').toUpperCase()) {
        case 'RECEIVED':
        case 'CONFIRMED':
        case 'RECEIVED_IN_CASH':
            return 'paid';
        case 'OVERDUE':
            return 'expired';
        case 'REFUNDED':
        case 'REFUND_REQUESTED':
            return 'refunded';
        case 'DELETED':
            return 'canceled';
        case 'AWAITING_RISK_ANALYSIS':
            return 'processing';
        default:
            return 'pending';
    }
}

async function resolveFinancialAccountForPayment(paymentId: string, webhookAccount?: any) {
    if (webhookAccount?.id && webhookAccount?.user_id) return webhookAccount;

    const payment = await findPaymentByProviderId(
        paymentId,
        'financial_account_id,user_id'
    );
    if (!payment?.financial_account_id) return null;

    const { data, error } = await supabaseAdmin
        .from('financial_accounts')
        .select('*')
        .eq('id', payment.financial_account_id)
        .maybeSingle();
    if (error) throw error;
    return data;
}

async function handlePaymentEvent(payment: any, event: string, webhookAccount?: any) {
    if (!payment?.id) return;

    const financialAccount = await resolveFinancialAccountForPayment(
        payment.id,
        webhookAccount
    );

    if (!financialAccount) {
        console.warn(`[asaas-webhook] Account not found for payment ${payment.id}`);
        return;
    }

    const nbPayment = await upsertPaymentFromProvider(
        financialAccount,
        payment,
        event
    );
    if (!nbPayment) return;

    await recordAppointmentPaymentView(nbPayment, payment, event);

    const state = normalizePaymentState(payment, event);
    const actualFee = Number(nbPayment.actual_fee_amount || 0);
    const grossAmount = Number(nbPayment.gross_amount || 0);

    if (state.fundsStatus === 'available' && actualFee > 0) {
        await upsertAccountMovement({
            userId: financialAccount.user_id,
            financialAccountId: financialAccount.id,
            movementType: 'payment_fee',
            direction: 'debit',
            amount: actualFee,
            description: 'Tarifa da cobrança',
            referenceType: 'payment',
            referenceId: payment.id,
            occurredAt: payment.paymentDate || new Date().toISOString(),
            metadata: { source: 'webhook', event },
        });
    }

    if (state.fundsStatus === 'refunded') {
        await upsertAccountMovement({
            userId: financialAccount.user_id,
            financialAccountId: financialAccount.id,
            movementType: 'refund',
            direction: 'debit',
            amount: Math.round(Number(payment.refundedValue || payment.value || 0) * 100),
            description: 'Estorno de cobrança',
            referenceType: 'payment',
            referenceId: payment.id,
            occurredAt: new Date().toISOString(),
            metadata: { source: 'webhook', event },
        });
    }

    if (state.fundsStatus === 'chargeback') {
        await upsertAccountMovement({
            userId: financialAccount.user_id,
            financialAccountId: financialAccount.id,
            movementType: 'chargeback',
            direction: 'debit',
            amount: grossAmount,
            description: 'Contestação de pagamento',
            referenceType: 'payment',
            referenceId: payment.id,
            occurredAt: new Date().toISOString(),
            metadata: { source: 'webhook', event },
        });
    }

    await refreshOverviewSnapshot(financialAccount.id);
    await touchFinancialAccountEvent(financialAccount.id, event);
    await syncFinancialEntryForPayment(nbPayment, {
        matchedBy: 'automatic',
        notes: `Webhook Asaas: ${event}`,
    });

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
        await tryScheduleAutomaticInvoice(nbPayment, payment);
    }

    await emitAsaasNotification({
        userId: financialAccount.user_id,
        financialAccountId: financialAccount.id,
        event,
        resource: payment,
        objectType: 'payment',
        actionUrl: event.includes('CHARGEBACK')
            ? '/financeiro?view=cobrancas-chargebacks'
            : '/financeiro?view=cobrancas-historia',
        context: await buildPaymentNotificationContext(nbPayment, payment, event),
    });

    console.log(`[asaas-webhook] Payment synchronized (${event}): ${nbPayment.id}`);
}

async function handlePaymentConfirmed(payment: any) {
    if (!payment?.id) return;

    // Find the nb_payment record
    const nbPayment = await findPaymentByProviderId(payment.id);

    if (!nbPayment) {
        console.warn(`[asaas-webhook] Payment not found for Asaas ID: ${payment.id}`);
        return;
    }

    if (nbPayment.status === 'paid') {
        console.log(`[asaas-webhook] Payment already marked as paid: ${nbPayment.id}`);
        return;
    }

    // Update payment status
    const valueCentavos = Math.round((payment.value || 0) * 100);
    const netValueCentavos = Math.round((payment.netValue || payment.value || 0) * 100);

    await supabaseAdmin
        .from('nb_payments')
        .update({
            status: 'paid',
            provider_payment_id: payment.id,
            paid_at: payment.paymentDate || new Date().toISOString(),
            net_amount: netValueCentavos,
            metadata: {
                ...nbPayment.metadata,
                asaas_payment_date: payment.paymentDate,
                asaas_confirmed_date: payment.confirmedDate,
                asaas_billing_type: payment.billingType,
                asaas_transaction_receipt_url: payment.transactionReceiptUrl,
            },
            updated_at: new Date().toISOString(),
        })
        .eq('id', nbPayment.id);

    await touchFinancialAccountEvent(nbPayment.financial_account_id, 'PAYMENT_CONFIRMED');

    await tryScheduleAutomaticInvoice(nbPayment, payment);

    // Notify user (optional — can fire async notification)
    console.log(`[asaas-webhook] Payment confirmed: ${nbPayment.id}, value: R$${(valueCentavos / 100).toFixed(2)}`);
}

async function tryScheduleAutomaticInvoice(nbPayment: any, payment: any) {
    try {
        const existingNfse = nbPayment?.nfse_reference || nbPayment?.metadata?.asaas_nfse_id;
        if (existingNfse) {
            console.log(`[asaas-webhook] Automatic NFS-e already linked: ${nbPayment.id} -> ${existingNfse}`);
            return;
        }

        const providerPaymentId = payment?.id || nbPayment?.provider_payment_id || nbPayment?.metadata?.asaas_payment_id;
        if (!providerPaymentId) return;

        const { data: settings } = await supabaseAdmin
            .from('user_fiscal_settings')
            .select('*')
            .eq('user_id', nbPayment.user_id)
            .maybeSingle();

        if (!settings?.auto_issue || (!settings.service_code && !settings.asaas_municipal_service_id)) return;

        const { data: financialAccount } = await supabaseAdmin
            .from('financial_accounts')
            .select('*')
            .eq('id', nbPayment.financial_account_id)
            .maybeSingle();
        const apiKey = await getFinancialAccountAsaasApiKey(financialAccount);
        if (!apiKey) return;

        const invoiceId = nbPayment?.metadata?.invoice_id;
        const payload = buildAsaasInvoicePayload({
            payment: providerPaymentId,
            serviceDescription: nbPayment.description || 'Servicos de psicologia e saude mental',
            observations: `Emissao automatica NeuroFinance para a cobranca ${providerPaymentId}.`,
            value: Number(payment.value || Number(nbPayment.gross_amount || 0) / 100 || 0),
            effectiveDate: new Date().toISOString().slice(0, 10),
            externalReference: nbPayment.id,
        }, settings);

        const scheduledInvoice = await createAsaasInvoice(apiKey, payload);
        await persistAsaasInvoiceState({
            userId: nbPayment.user_id,
            financialAccountId: nbPayment.financial_account_id,
            nbPaymentId: nbPayment.id,
            providerPaymentId,
            legacyInvoiceId: invoiceId || null,
            invoice: scheduledInvoice,
        });

        if (scheduledInvoice?.id) {
            const authorizedInvoice = await authorizeAsaasInvoice(apiKey, scheduledInvoice.id);
            await persistAsaasInvoiceState({
                userId: nbPayment.user_id,
                financialAccountId: nbPayment.financial_account_id,
                nbPaymentId: nbPayment.id,
                providerPaymentId,
                legacyInvoiceId: invoiceId || null,
                invoice: authorizedInvoice,
            });
        }

    } catch (error) {
        console.warn('[asaas-webhook] Automatic NFS-e scheduling deferred:', error);
        await markAutomaticNfseFailure(nbPayment, payment, error);
    }
}

async function markAutomaticNfseFailure(nbPayment: any, payment: any, error: any) {
    if (!nbPayment?.id) return;
    const message = error?.message || 'Falha ao emitir NFS-e pela Asaas.';
    const now = new Date().toISOString();

    await supabaseAdmin
        .from('nb_payments')
        .update({
            nfse_status: 'ERROR',
            nfse_status_description: message,
            nfse_error_message: message,
            nfse_synced_at: now,
            metadata: {
                ...(nbPayment.metadata || {}),
                asaas_nfse_last_error: message,
                asaas_nfse_last_error_at: now,
            },
            updated_at: now,
        })
        .eq('id', nbPayment.id);

    const legacyInvoiceId = nbPayment?.metadata?.invoice_id || null;
    if (legacyInvoiceId) {
        await supabaseAdmin
            .from('invoices')
            .update({
                nfse_status: 'ERROR',
                nfse_status_description: message,
                nfse_error_message: message,
                nfse_synced_at: now,
                updated_at: now,
            })
            .eq('id', legacyInvoiceId);
    }

    const { error: notificationError } = await supabaseAdmin.rpc('emit_user_notification', {
        p_user_id: nbPayment.user_id,
        p_event_id: `asaas:INVOICE_ERROR:auto:${nbPayment.id}`,
        p_type: 'asaas_invoice_error',
        p_category: 'financeiro',
        p_severity: 'destructive',
        p_title: 'Erro na nota fiscal',
        p_message: 'A emissao automatica de NFS-e falhou. Revise os dados fiscais no NeuroFinance.',
        p_action_url: '/financeiro?view=fiscal-lista',
        p_priority: 'high',
        p_data: {
            sourceModule: 'financeiro',
            financeScope: 'neurofinance',
            eventSource: 'asaas_webhook',
            provider: 'asaas',
            asaasEvent: 'INVOICE_ERROR',
            providerPaymentId: payment?.id || nbPayment.provider_payment_id || null,
            patientId: nbPayment.patient_id || null,
            financialAccountId: nbPayment.financial_account_id || null,
            requiresAction: true,
            nativePushEligible: true,
        },
        p_payload: {
            provider: 'asaas',
            objectType: 'invoice',
            error: message,
        },
        p_organization_id: null,
    });

    if (notificationError) {
        console.warn('[asaas-webhook] Failed to emit automatic NFS-e failure notification:', notificationError);
    }
}

async function handlePaymentOverdue(payment: any) {
    if (!payment?.id) return;

    const nbPayment = await findPaymentByProviderId(payment.id, 'id, status, financial_account_id');

    if (!nbPayment || nbPayment.status === 'paid') return;

    await supabaseAdmin
        .from('nb_payments')
        .update({
            status: 'expired',
            provider_payment_id: payment.id,
            updated_at: new Date().toISOString(),
        })
        .eq('id', nbPayment.id);

    await touchFinancialAccountEvent(nbPayment.financial_account_id, 'PAYMENT_OVERDUE');

    console.log(`[asaas-webhook] Payment overdue: ${nbPayment.id}`);
}

async function handlePaymentRefunded(payment: any, event: string) {
    if (!payment?.id) return;

    const nbPayment = await findPaymentByProviderId(payment.id);

    if (!nbPayment) return;

    const refundValue = Math.round((payment.value || 0) * 100);

    const newStatus = event === 'PAYMENT_REFUND_IN_PROGRESS' ? 'processing' : 'refunded';

    await supabaseAdmin
        .from('nb_payments')
        .update({
            status: newStatus,
            provider_payment_id: payment.id,
            refund_amount: refundValue,
            updated_at: new Date().toISOString(),
        })
        .eq('id', nbPayment.id);

    await touchFinancialAccountEvent(nbPayment.financial_account_id, event);

    console.log(`[asaas-webhook] Payment refund (${event}): ${nbPayment.id}`);
}

async function handlePaymentDeleted(payment: any) {
    if (!payment?.id) return;

    const nbPayment = await findPaymentByProviderId(payment.id, 'id, status, financial_account_id');

    if (!nbPayment || nbPayment.status === 'paid') return;

    await supabaseAdmin
        .from('nb_payments')
        .update({
            status: 'canceled',
            provider_payment_id: payment.id,
            updated_at: new Date().toISOString(),
        })
        .eq('id', nbPayment.id);

    await touchFinancialAccountEvent(nbPayment.financial_account_id, 'PAYMENT_DELETED');

    console.log(`[asaas-webhook] Payment deleted/canceled: ${nbPayment.id}`);
}

// ─────────────────────────────────────────────────────────────
// Transfer (payout) handlers
// ─────────────────────────────────────────────────────────────

async function handlePaymentInfo(payment: any, event: string) {
    if (!payment?.id) return;

    const nbPayment = await findPaymentByProviderId(payment.id);

    if (!nbPayment) {
        console.log(`[asaas-webhook] Info payment not found locally: ${payment.id}`);
        return;
    }

    const valueCentavos = Math.round((payment.value || 0) * 100);
    const netValueCentavos = Math.round((payment.netValue || payment.value || 0) * 100);
    const mappedStatus = mapAsaasPaymentStatus(payment.status);
    const status = nbPayment.status === 'paid' ? 'paid' : mappedStatus;

    await supabaseAdmin
        .from('nb_payments')
        .update({
            status,
            provider_payment_id: payment.id,
            gross_amount: valueCentavos || nbPayment.gross_amount,
            net_amount: netValueCentavos || nbPayment.net_amount,
            checkout_url: payment.invoiceUrl || nbPayment.checkout_url,
            metadata: {
                ...nbPayment.metadata,
                asaas_payment_id: payment.id,
                asaas_status: payment.status || null,
                asaas_billing_type: payment.billingType || null,
                asaas_invoice_url: payment.invoiceUrl || null,
                asaas_bank_slip_url: payment.bankSlipUrl || null,
                asaas_last_event: event,
            },
            updated_at: new Date().toISOString(),
        })
        .eq('id', nbPayment.id);

    await touchFinancialAccountEvent(nbPayment.financial_account_id, event);
    console.log(`[asaas-webhook] Payment info updated (${event}): ${nbPayment.id}`);
}

function normalizeAnticipationStatus(status: string) {
    const value = String(status || '').toUpperCase();
    if (['CREDITED', 'APPROVED', 'DONE'].includes(value)) return 'credited';
    if (['DENIED', 'REFUSED', 'REJECTED'].includes(value)) return 'denied';
    if (['CANCELLED', 'CANCELED'].includes(value)) return 'cancelled';
    if (value === 'DEBITED') return 'debited';
    if (value === 'OVERDUE') return 'overdue';
    if (value === 'SCHEDULED') return 'scheduled';
    return 'pending';
}

async function handleReceivableAnticipationEvent(anticipation: any, event: string, webhookAccount?: any) {
    if (!anticipation?.id) return;

    let financialAccount = webhookAccount;
    const providerPaymentId = anticipation.payment || anticipation.paymentId;
    let localPayment: any = null;

    if (providerPaymentId) {
        localPayment = await findPaymentByProviderId(providerPaymentId, 'id, user_id, financial_account_id, provider_payment_id');
        if (!financialAccount && localPayment?.financial_account_id) {
            const { data, error } = await supabaseAdmin
                .from('financial_accounts')
                .select('*')
                .eq('id', localPayment.financial_account_id)
                .maybeSingle();
            if (error) throw error;
            financialAccount = data;
        }
    }

    if (!financialAccount) {
        console.warn(`[asaas-webhook] Account not found for anticipation ${anticipation.id}`);
        return;
    }

    const normalizedStatus = normalizeAnticipationStatus(anticipation.status);
    const netAmount = Math.round(Number(anticipation.netValue || anticipation.anticipatedValue || anticipation.value || 0) * 100);

    await supabaseAdmin
        .from('neurofinance_anticipations')
        .upsert({
            user_id: financialAccount.user_id,
            financial_account_id: financialAccount.id,
            provider: 'asaas',
            provider_anticipation_id: anticipation.id,
            provider_status: anticipation.status || null,
            normalized_status: normalizedStatus,
            payment_id: localPayment?.id || null,
            provider_payment_id: providerPaymentId || null,
            installment_id: anticipation.installment || anticipation.installmentId || null,
            gross_amount: Math.round(Number(anticipation.totalValue || anticipation.value || 0) * 100),
            anticipated_amount: Math.round(Number(anticipation.anticipatedValue || anticipation.value || 0) * 100),
            fee_amount: Math.round(Number(anticipation.fee || anticipation.anticipationFee || 0) * 100),
            net_amount: netAmount,
            anticipation_days: Number(anticipation.anticipationDays || 0) || null,
            anticipation_date: anticipation.anticipationDate || null,
            due_date: anticipation.dueDate || null,
            requested_at: anticipation.dateCreated || new Date().toISOString(),
            credited_at: anticipation.creditedDate || null,
            documents_required: Boolean(anticipation.isDocumentationRequired),
            denial_observation: anticipation.denialObservation || null,
            provider_payload: anticipation,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'provider,provider_anticipation_id' });

    if (providerPaymentId && ['scheduled', 'credited'].includes(normalizedStatus)) {
        await supabaseAdmin
            .from('nb_payments')
            .update({ anticipated: true, updated_at: new Date().toISOString() })
            .eq('provider_payment_id', providerPaymentId);
    }

    if (normalizedStatus === 'credited' && netAmount > 0) {
        await upsertAccountMovement({
            userId: financialAccount.user_id,
            financialAccountId: financialAccount.id,
            movementType: 'anticipation_credit',
            direction: 'credit',
            amount: netAmount,
            description: 'Antecipação creditada',
            referenceType: 'anticipation',
            referenceId: anticipation.id,
            occurredAt: anticipation.creditedDate || new Date().toISOString(),
            metadata: { source: 'webhook', event },
        });
    }

    if (normalizedStatus === 'debited' && netAmount > 0) {
        await upsertAccountMovement({
            userId: financialAccount.user_id,
            financialAccountId: financialAccount.id,
            movementType: 'anticipation_debit',
            direction: 'debit',
            amount: netAmount,
            description: 'Débito de antecipação',
            referenceType: 'anticipation',
            referenceId: anticipation.id,
            occurredAt: new Date().toISOString(),
            metadata: { source: 'webhook', event },
        });
    }

    await refreshOverviewSnapshot(financialAccount.id);
    await touchFinancialAccountEvent(financialAccount.id, event);
    await emitAsaasNotification({
        userId: financialAccount.user_id,
        financialAccountId: financialAccount.id,
        event,
        resource: anticipation,
        objectType: 'anticipation',
        actionUrl: '/financeiro?view=antecipacoes-lista',
    });
}

async function findBillPaymentByProviderResource(bill: any) {
    if (!bill?.id && !bill?.externalReference) return null;

    let query = supabaseAdmin
        .from('neurofinance_bill_payments')
        .select('*');
    query = bill?.id
        ? query.eq('provider_bill_id', bill.id)
        : query.eq('external_reference', bill.externalReference);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
}

async function handleBillEvent(bill: any, event: string) {
    const record = await findBillPaymentByProviderResource(bill);
    if (!record) {
        console.warn(`[asaas-webhook] Bill payment not found: ${bill?.id || bill?.externalReference || event}`);
        return;
    }

    const providerStatus = String(bill?.status || event.replace(/^BILL_/, '')).toUpperCase();
    const scheduleDate = bill?.scheduleDate || record.scheduled_date;
    const status = normalizeBillPaymentStatus(providerStatus, scheduleDate, dateInTimeZone());
    const receiptUrl = bill?.transactionReceiptUrl ||
        bill?.receiptUrl ||
        record.receipt_url ||
        null;
    const failureMessage = Array.isArray(bill?.failReasons)
        ? bill.failReasons.map((reason: any) => reason?.description || reason?.message || String(reason)).join('; ')
        : bill?.failReasons
            ? String(bill.failReasons)
            : null;

    const providerPayload = {
        ...(record.provider_payload || {}),
        execution: bill || record.provider_payload?.execution || {},
        latestWebhook: {
            event,
            receivedAt: new Date().toISOString(),
            bill: bill || {},
        },
    };

    const { error } = await supabaseAdmin
        .from('neurofinance_bill_payments')
        .update({
            provider_status: providerStatus,
            status,
            amount: bill?.value != null
                ? Math.round(Number(bill.value || 0) * 100)
                : Number(record.amount || 0),
            fee_amount: bill?.fee != null
                ? Math.round(Number(bill.fee || 0) * 100)
                : Number(record.fee_amount || 0),
            due_date: bill?.dueDate || record.due_date,
            scheduled_date: scheduleDate,
            payment_date: bill?.paymentDate || record.payment_date,
            paid_at: status === 'paid' ? record.paid_at || new Date().toISOString() : record.paid_at,
            can_be_cancelled: bill?.canBeCancelled == null
                ? record.can_be_cancelled
                : Boolean(bill.canBeCancelled),
            receipt_url: receiptUrl,
            provider_payload: providerPayload,
            error_code: status === 'failed' ? event : null,
            error_message: status === 'failed' ? failureMessage || 'Pagamento não confirmado pela instituição.' : null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', record.id);
    if (error) throw error;

    await refreshOverviewSnapshot(record.financial_account_id);
    await touchFinancialAccountEvent(record.financial_account_id, event);
    await emitAsaasNotification({
        userId: record.user_id,
        financialAccountId: record.financial_account_id,
        event,
        resource: bill,
        objectType: 'bill',
        actionUrl: '/financeiro?view=pagamentos-agendados',
    });
    console.log(`[asaas-webhook] Bill synchronized (${event}): ${record.id}`);
}

async function updateSecureOutgoingTransfer(transfer: any, values: Record<string, unknown>) {
    const { data: request, error: findError } = await supabaseAdmin
        .from('neurofinance_outgoing_requests')
        .select('id, provider_payload')
        .eq('provider_operation_id', transfer.id)
        .maybeSingle();
    if (findError) throw findError;
    if (!request) return;

    const { error } = await supabaseAdmin
        .from('neurofinance_outgoing_requests')
        .update({
            ...values,
            provider_payload: {
                ...(request.provider_payload || {}),
                latestWebhook: transfer,
            },
            updated_at: new Date().toISOString(),
        })
        .eq('id', request.id);
    if (error) throw error;
}

async function handleTransferPending(transfer: any, event = 'TRANSFER_PENDING') {
    if (!transfer?.id) return;

    const payout = await findPayoutByProviderId(transfer.id, 'id,user_id,financial_account_id');

    if (!payout) {
        console.log(`[asaas-webhook] Transfer not found in nb_payouts: ${transfer.id}`);
        return;
    }

    await supabaseAdmin
        .from('nb_payouts')
        .update({
            status: 'in_transit',
            provider_status: String(transfer.status || 'PENDING').toUpperCase(),
            provider_payout_id: transfer.id,
            receipt_url: transfer.transactionReceiptUrl || null,
            provider_payload: transfer,
            updated_at: new Date().toISOString(),
        })
        .eq('id', payout.id);

    await updateSecureOutgoingTransfer(transfer, {
        status: 'in_transit',
        provider_status: String(transfer.status || 'PENDING').toUpperCase(),
        receipt_url: transfer.transactionReceiptUrl || null,
    });

    await touchFinancialAccountEvent(payout.financial_account_id, event);
    await emitAsaasNotification({
        userId: payout.user_id,
        financialAccountId: payout.financial_account_id,
        event,
        resource: transfer,
        objectType: 'transfer',
        actionUrl: '/financeiro?view=transferencias',
    });
}

async function handleTransferDone(transfer: any) {
    if (!transfer?.id) return;

    const payout = await findPayoutByProviderId(transfer.id);

    if (!payout) return;

    await supabaseAdmin
        .from('nb_payouts')
        .update({
            status: 'paid',
            provider_status: 'DONE',
            provider_payout_id: transfer.id,
            processed_at: new Date().toISOString(),
            completed_at: transfer.effectiveDate || transfer.confirmedDate || new Date().toISOString(),
            fee_amount: transfer.transferFee != null
                ? Math.round(Number(transfer.transferFee || 0) * 100)
                : Number(payout.fee_amount || 0),
            receipt_url: transfer.transactionReceiptUrl || payout.receipt_url || null,
            provider_payload: transfer,
            reconciliation_status: 'reconciled',
            reconciled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', payout.id);

    await updateSecureOutgoingTransfer(transfer, {
        status: 'paid',
        provider_status: 'DONE',
        receipt_url: transfer.transactionReceiptUrl || payout.receipt_url || null,
        completed_at: transfer.effectiveDate || transfer.confirmedDate || new Date().toISOString(),
    });

    await upsertAccountMovement({
        userId: payout.user_id,
        financialAccountId: payout.financial_account_id,
        movementType: 'transfer',
        direction: 'debit',
        amount: Number(payout.amount || Math.round(Number(transfer.value || 0) * 100)),
        description: payout.destination_summary || 'Transferência concluída',
        referenceType: 'payout',
        referenceId: transfer.id,
        occurredAt: transfer.effectiveDate || transfer.confirmedDate || new Date().toISOString(),
        metadata: { source: 'webhook', event: 'TRANSFER_DONE' },
    });

    const transferFee = Math.round(Number(transfer.transferFee || 0) * 100);
    if (transferFee > 0) {
        await upsertAccountMovement({
            userId: payout.user_id,
            financialAccountId: payout.financial_account_id,
            movementType: 'transfer_fee',
            direction: 'debit',
            amount: transferFee,
            description: 'Tarifa da transferência',
            referenceType: 'payout',
            referenceId: transfer.id,
            occurredAt: transfer.effectiveDate || transfer.confirmedDate || new Date().toISOString(),
            metadata: { source: 'webhook', event: 'TRANSFER_DONE' },
        });
    }

    await refreshOverviewSnapshot(payout.financial_account_id);
    await touchFinancialAccountEvent(payout.financial_account_id, 'TRANSFER_DONE');
    await emitAsaasNotification({
        userId: payout.user_id,
        financialAccountId: payout.financial_account_id,
        event: 'TRANSFER_DONE',
        resource: transfer,
        objectType: 'transfer',
        actionUrl: '/financeiro?view=transferencias',
    });

    console.log(`[asaas-webhook] Transfer completed: ${payout.id}`);
}

async function handleTransferFailed(transfer: any, event: string) {
    if (!transfer?.id) return;

    const payout = await findPayoutByProviderId(transfer.id);

    if (!payout) return;

    const status = event === 'TRANSFER_CANCELLED' ? 'canceled' : 'failed';

    await supabaseAdmin
        .from('nb_payouts')
        .update({
            status,
            provider_status: event === 'TRANSFER_CANCELLED' ? 'CANCELLED' : 'FAILED',
            provider_payout_id: transfer.id,
            provider_payload: transfer,
            error_message: transfer.failReason || transfer.refusalReason || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', payout.id);

    await updateSecureOutgoingTransfer(transfer, {
        status,
        provider_status: event === 'TRANSFER_CANCELLED' ? 'CANCELLED' : 'FAILED',
        error_message: transfer.failReason || transfer.refusalReason || null,
    });

    await touchFinancialAccountEvent(payout.financial_account_id, event);
    await emitAsaasNotification({
        userId: payout.user_id,
        financialAccountId: payout.financial_account_id,
        event,
        resource: transfer,
        objectType: 'transfer',
        actionUrl: '/financeiro?view=transferencias',
    });

    console.log(`[asaas-webhook] Transfer ${status}: ${payout.id}`);
}

async function handleAccountStatus(accountStatusPayload: any, event: string) {
    if (!accountStatusPayload?.id) {
        console.log(`[asaas-webhook] Account status event without account id: ${event}`);
        return;
    }

    const financialAccount = await getFinancialAccountByAsaasId(accountStatusPayload.id);
    if (!financialAccount) {
        console.log(`[asaas-webhook] Financial account not found for Asaas account: ${accountStatusPayload.id}`);
        return;
    }

    const accountStatus = normalizeAsaasAccountStatusPayload(accountStatusPayload);
    await syncFinancialAccountFromAsaas(financialAccount.id, accountStatus, 'webhook');
    await touchFinancialAccountEvent(financialAccount.id, event);
    await emitAsaasNotification({
        userId: financialAccount.user_id,
        financialAccountId: financialAccount.id,
        event,
        resource: accountStatusPayload,
        objectType: 'account_status',
        actionUrl: '/financeiro?view=saude-conta',
    });

    console.log(`[asaas-webhook] Account status synced (${event}): ${financialAccount.id}`);
}

async function handleInvoiceEvent(invoice: any, event: string, webhookAccount?: any) {
    if (!invoice?.id) {
        console.log(`[asaas-webhook] Invoice event without invoice id: ${event}`);
        return;
    }

    let financialAccount = webhookAccount;
    const providerPaymentId = invoice.payment || invoice.paymentId || null;
    let nbPayment: any = null;

    if (providerPaymentId) {
        nbPayment = await findPaymentByProviderId(providerPaymentId, 'id,user_id,patient_id,financial_account_id,provider_payment_id,metadata');

        if (!financialAccount && nbPayment?.financial_account_id) {
            const { data, error } = await supabaseAdmin
                .from('financial_accounts')
                .select('*')
                .eq('id', nbPayment.financial_account_id)
                .maybeSingle();
            if (error) throw error;
            financialAccount = data;
        }
    }

    if (!financialAccount?.user_id) {
        console.log(`[asaas-webhook] Invoice event without linked account: ${event}`);
        return;
    }

    await persistAsaasInvoiceState({
        userId: financialAccount.user_id,
        financialAccountId: financialAccount.id,
        nbPaymentId: nbPayment?.id || null,
        providerPaymentId,
        legacyInvoiceId: nbPayment?.metadata?.invoice_id || null,
        invoice,
        errorMessage: event === 'INVOICE_ERROR' ? invoice.statusDescription || 'Erro retornado pela Asaas.' : null,
    });

    await touchFinancialAccountEvent(financialAccount.id, event);
    await emitAsaasNotification({
        userId: financialAccount.user_id,
        financialAccountId: financialAccount.id,
        event,
        resource: invoice,
        objectType: 'invoice',
        actionUrl: '/financeiro?view=fiscal-lista',
        context: {
            patientId: nbPayment?.patient_id || null,
        },
    });

    console.log(`[asaas-webhook] Invoice synchronized (${event}): ${invoice.id}`);
}

async function handleGenericAsaasEvent(body: any, resource: any, event: string, webhookAccount?: any) {
    if (ADMIN_ONLY_ASAAS_EVENTS.has(event)) {
        console.log(`[asaas-webhook] Admin-only event ignored for psychologist notifications: ${event}`);
        return;
    }

    if (!webhookAccount?.user_id) {
        console.log(`[asaas-webhook] Generic event without linked account: ${event}`);
        return;
    }

    await touchFinancialAccountEvent(webhookAccount.id, event);
    await emitAsaasNotification({
        userId: webhookAccount.user_id,
        financialAccountId: webhookAccount.id,
        event,
        resource: resource || body,
        objectType: inferProviderObjectType(body),
        actionUrl: event.startsWith('TRANSFER_')
            ? '/financeiro?view=transferencias'
            : event.startsWith('BILL_')
                ? '/financeiro?view=pagamentos-agendados'
                : event.startsWith('PAYMENT_')
                    ? '/financeiro?view=cobrancas-historia'
                    : '/financeiro?view=conta-digital',
    });
}

function getPlatformSubscriptionReference(body: any, resource: any) {
    return String(
        body?.payment?.externalReference ||
        body?.subscription?.externalReference ||
        body?.checkout?.externalReference ||
        resource?.externalReference ||
        body?.externalReference ||
        ''
    ).trim();
}

function getProviderSubscriptionId(body: any, resource: any) {
    return String(
        body?.subscription?.id ||
        body?.payment?.subscription ||
        body?.checkout?.subscription ||
        body?.checkout?.subscriptionId ||
        resource?.subscription ||
        resource?.subscriptionId ||
        ''
    ).trim();
}

function getProviderCheckoutId(body: any, resource: any) {
    return String(
        body?.checkout?.id ||
        body?.payment?.checkoutSession ||
        body?.payment?.checkoutSessionId ||
        resource?.checkoutSession ||
        resource?.checkoutSessionId ||
        resource?.checkout ||
        (resource?.object === 'checkout' ? resource?.id : '') ||
        ''
    ).trim();
}

function getProviderPaymentId(body: any, resource: any) {
    return String(
        body?.payment?.id ||
        (resource?.object === 'payment' ? resource?.id : '') ||
        ''
    ).trim();
}

function getProviderCustomerId(body: any, resource: any) {
    return String(
        body?.payment?.customer ||
        body?.subscription?.customer ||
        body?.checkout?.customer ||
        resource?.customer ||
        ''
    ).trim();
}

function getBillingType(resource: any) {
    return String(resource?.billingType || resource?.billing_type || '').trim() || null;
}

function eventOccurredAt(body: any, resource: any) {
    const raw =
        body?.dateCreated ||
        body?.createdAt ||
        body?.eventDate ||
        resource?.dateCreated ||
        resource?.confirmedDate ||
        resource?.paymentDate ||
        resource?.clientPaymentDate ||
        resource?.createdAt ||
        null;
    const parsed = raw ? new Date(raw) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function subscriptionPeriodEnd(resource: any) {
    const raw = resource?.nextDueDate || resource?.endDate || null;
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isOlderDowngrade(subscription: any, nextStatus: string, eventAt: string) {
    if (!subscription?.last_payment_event_at) return false;
    if (['active', 'admin_override', 'refunded', 'chargeback'].includes(nextStatus)) return false;
    if (subscription.status !== 'active') return false;

    const last = new Date(subscription.last_payment_event_at).getTime();
    const incoming = new Date(eventAt).getTime();
    return Number.isFinite(last) && Number.isFinite(incoming) && incoming < last;
}

async function getSubscriptionByUserId(userId: string) {
    const { data, error } = await supabaseAdmin
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    return data;
}

async function upsertUserSubscriptionByUserId(userId: string, values: Record<string, unknown>) {
    const existing = await getSubscriptionByUserId(userId);

    if (existing?.id) {
        const { error } = await supabaseAdmin
            .from('user_subscriptions')
            .update(values)
            .eq('id', existing.id);
        if (error) throw error;
        return { ...existing, ...values };
    }

    const { data, error } = await supabaseAdmin
        .from('user_subscriptions')
        .insert({
            user_id: userId,
            ...values,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function findPlatformCheckoutSession(body: any, resource: any) {
    const externalReference = getPlatformSubscriptionReference(body, resource);
    const providerCheckoutId = getProviderCheckoutId(body, resource);
    const providerSubscriptionId = getProviderSubscriptionId(body, resource);

    if (externalReference) {
        const { data, error } = await supabaseAdmin
            .from('subscription_checkout_sessions')
            .select('*')
            .eq('external_reference', externalReference)
            .maybeSingle();
        if (error) throw error;
        if (data) return data;
    }

    if (providerCheckoutId) {
        const { data, error } = await supabaseAdmin
            .from('subscription_checkout_sessions')
            .select('*')
            .eq('provider_checkout_id', providerCheckoutId)
            .maybeSingle();
        if (error) throw error;
        if (data) return data;
    }

    if (providerSubscriptionId) {
        const { data, error } = await supabaseAdmin
            .from('subscription_checkout_sessions')
            .select('*')
            .eq('provider_subscription_id', providerSubscriptionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        if (data) return data;
    }

    return null;
}

async function findPlatformUserSubscription(body: any, resource: any, checkoutSession: any) {
    const providerSubscriptionId = getProviderSubscriptionId(body, resource);

    if (providerSubscriptionId) {
        const { data, error } = await supabaseAdmin
            .from('user_subscriptions')
            .select('*')
            .eq('asaas_subscription_id', providerSubscriptionId)
            .maybeSingle();
        if (error) throw error;
        if (data) return data;
    }

    if (checkoutSession?.user_id) {
        return await getSubscriptionByUserId(checkoutSession.user_id);
    }

    return null;
}

async function resolvePlatformContext(body: any, resource: any) {
    const externalReference = getPlatformSubscriptionReference(body, resource);
    const providerSubscriptionId = getProviderSubscriptionId(body, resource);
    const providerCheckoutId = getProviderCheckoutId(body, resource);
    const looksLikePlatformReference = externalReference.startsWith('nnx_sub_');

    const checkoutSession = await findPlatformCheckoutSession(body, resource);
    const userSubscription = await findPlatformUserSubscription(body, resource, checkoutSession);
    const userId = checkoutSession?.user_id || userSubscription?.user_id || null;

    if (!userId) {
        if (looksLikePlatformReference || providerSubscriptionId || providerCheckoutId) {
            console.log(`[asaas-webhook] Platform billing context not found for reference=${externalReference || 'none'}`);
        }
        return null;
    }

    return {
        userId,
        checkoutSession,
        userSubscription,
        externalReference: externalReference || checkoutSession?.external_reference || userSubscription?.external_reference || '',
        providerSubscriptionId,
        providerCheckoutId,
    };
}

async function recordPlatformSubscriptionEvent(
    body: any,
    resource: any,
    event: string,
    context: any,
    effect: 'history_only' | 'checkout_update' | 'access_granted' | 'access_blocked' | 'access_warning' | 'error',
) {
    const providerEventId = String(body?.id || `${event}_${resource?.id || context.externalReference || Date.now()}`);
    const payload = {
        user_id: context.userId,
        subscription_record_id: context.userSubscription?.id || null,
        checkout_session_id: context.checkoutSession?.id || null,
        provider: 'asaas',
        provider_event_id: providerEventId,
        event_type: event,
        object_type: inferProviderObjectType(body),
        object_id: String(resource?.id || ''),
        external_reference: context.externalReference || null,
        provider_subscription_id: context.providerSubscriptionId || context.checkoutSession?.provider_subscription_id || null,
        provider_payment_id: getProviderPaymentId(body, resource) || null,
        provider_checkout_id: context.providerCheckoutId || context.checkoutSession?.provider_checkout_id || null,
        event_created_at: eventOccurredAt(body, resource),
        processed_at: new Date().toISOString(),
        processing_status: 'processed',
        effect,
        payload: body,
    };

    const { data, error } = await supabaseAdmin
        .from('subscription_events')
        .insert(payload)
        .select('id')
        .maybeSingle();

    if (error && error.code !== '23505') throw error;
    if (error?.code === '23505') {
        const { data: existing } = await supabaseAdmin
            .from('subscription_events')
            .select('id')
            .eq('provider', 'asaas')
            .eq('provider_event_id', providerEventId)
            .maybeSingle();
        return existing?.id || null;
    }

    return data?.id || null;
}

async function auditPlatformAccessChange(context: any, eventId: string | null, action: string, fromSubscription: any, nextStatus: string, nextAccessState: string, reason: string) {
    const { error } = await supabaseAdmin.from('subscription_audit_logs').insert({
        user_id: context.userId,
        subscription_record_id: fromSubscription?.id || context.userSubscription?.id || null,
        checkout_session_id: context.checkoutSession?.id || null,
        event_id: eventId,
        actor_type: 'asaas_webhook',
        action,
        from_status: fromSubscription?.status || null,
        to_status: nextStatus,
        from_access_state: fromSubscription?.access_state || null,
        to_access_state: nextAccessState,
        reason,
        metadata: {
            external_reference: context.externalReference || null,
            provider_subscription_id: context.providerSubscriptionId || null,
            provider_checkout_id: context.providerCheckoutId || null,
        },
    });
    if (error) console.warn('[asaas-webhook] subscription audit failed:', error);
}

const PAYMENT_PROOF_STATUSES = new Set([
    'CONFIRMED',
    'RECEIVED',
    'RECEIVED_IN_CASH',
    'CHECKOUT_PAID',
    'PAYMENT_CONFIRMED',
    'PAYMENT_RECEIVED',
]);

const PAYMENT_PROOF_EVENTS = new Set([
    'CHECKOUT_PAID',
    'PAYMENT_CONFIRMED',
    'PAYMENT_RECEIVED',
]);

function upper(value?: unknown) {
    return String(value || '').trim().toUpperCase();
}

function hasConfirmedPaymentMarker(subscription: any) {
    if (!subscription) return false;
    if (subscription.status === 'admin_override') return true;
    return (
        subscription.status === 'active' &&
        subscription.access_state === 'paid_access' &&
        (
            PAYMENT_PROOF_STATUSES.has(upper(subscription.last_payment_status)) ||
            PAYMENT_PROOF_EVENTS.has(upper(subscription.metadata?.last_asaas_event))
        )
    );
}

function storedPaymentStatusForEvent(event: string, resource: any) {
    const normalizedEvent = upper(event);
    if (normalizedEvent === 'CHECKOUT_PAID') return 'CHECKOUT_PAID';
    if (normalizedEvent.startsWith('CHECKOUT_') || normalizedEvent.startsWith('SUBSCRIPTION_')) {
        return normalizedEvent;
    }
    return String(resource?.status || normalizedEvent || event);
}

function currentAccessBeforePayment(subscription: any) {
    if (!subscription) return null;

    const trialEnd = subscription.trial_ends_at
        ? new Date(subscription.trial_ends_at).getTime()
        : Number.NaN;
    if (
        subscription.status === 'trialing' &&
        subscription.access_state === 'trial_access' &&
        Number.isFinite(trialEnd) &&
        trialEnd > Date.now()
    ) {
        return {
            status: 'trialing',
            accessState: 'trial_access',
            effect: 'checkout_update' as const,
        };
    }

    if (subscription.status === 'admin_override') {
        return {
            status: 'admin_override',
            accessState: 'admin_override',
            effect: 'history_only' as const,
        };
    }

    return null;
}

function subscriptionTransitionForEvent(event: string, providerStatus: string, currentStatus?: string, currentAccessState?: string, currentSubscription?: any) {
    const alreadyPaymentBacked = hasConfirmedPaymentMarker(currentSubscription);
    const preservedAccess = currentAccessBeforePayment(currentSubscription);

    if (event === 'CHECKOUT_CREATED') {
        if (alreadyPaymentBacked) {
            return { status: 'active', accessState: 'paid_access', checkoutStatus: 'created', effect: 'history_only' as const };
        }
        if (preservedAccess) return { ...preservedAccess, checkoutStatus: 'created' };
        return { status: 'active', accessState: 'limited_access', checkoutStatus: 'created', effect: 'checkout_update' as const };
    }
    if (event === 'CHECKOUT_PAID') return { status: 'active', accessState: 'paid_access', checkoutStatus: 'paid', effect: 'access_granted' as const };
    if (event === 'CHECKOUT_CANCELED') {
        if (preservedAccess) return { ...preservedAccess, checkoutStatus: 'canceled' };
        return { status: 'active', accessState: 'limited_access', checkoutStatus: 'canceled', effect: 'checkout_update' as const };
    }
    if (event === 'CHECKOUT_EXPIRED') {
        if (preservedAccess) return { ...preservedAccess, checkoutStatus: 'expired' };
        return { status: 'active', accessState: 'limited_access', checkoutStatus: 'expired', effect: 'checkout_update' as const };
    }
    if (event === 'SUBSCRIPTION_INACTIVATED' || event === 'SUBSCRIPTION_DELETED') {
        return { status: 'canceled', accessState: 'blocked', checkoutStatus: 'blocked', effect: 'access_blocked' as const };
    }
    if (event === 'SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK') {
        return { status: 'past_due', accessState: 'blocked', checkoutStatus: 'blocked', effect: 'access_blocked' as const };
    }
    if (providerStatus === 'INACTIVE' || providerStatus === 'DELETED') {
        return { status: 'canceled', accessState: 'blocked', checkoutStatus: 'blocked', effect: 'access_blocked' as const };
    }
    if (event === 'SUBSCRIPTION_CREATED' || event === 'SUBSCRIPTION_UPDATED') {
        if (alreadyPaymentBacked) {
            return { status: 'active', accessState: 'paid_access', checkoutStatus: 'updated', effect: 'history_only' as const };
        }
        if (preservedAccess) return { ...preservedAccess, checkoutStatus: 'payment_pending' };
        return { status: 'active', accessState: 'limited_access', checkoutStatus: 'payment_pending', effect: 'checkout_update' as const };
    }
    if (preservedAccess) return { ...preservedAccess, checkoutStatus: 'updated' };
    return alreadyPaymentBacked
        ? { status: 'active', accessState: 'paid_access', checkoutStatus: 'updated', effect: 'history_only' as const }
        : { status: 'active', accessState: 'limited_access', checkoutStatus: 'updated', effect: 'history_only' as const };
}

function paymentTransitionForEvent(event: string, currentStatus?: string, currentAccessState?: string, currentSubscription?: any) {
    const alreadyPaymentBacked = hasConfirmedPaymentMarker(currentSubscription);
    const preservedAccess = currentAccessBeforePayment(currentSubscription);

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
        return { status: 'active', accessState: 'paid_access', checkoutStatus: 'paid', effect: 'access_granted' as const };
    }
    if (event === 'PAYMENT_OVERDUE') {
        if (preservedAccess) return { ...preservedAccess, checkoutStatus: 'payment_pending', effect: 'access_warning' as const };
        return { status: 'active', accessState: 'limited_access', checkoutStatus: 'payment_pending', effect: 'access_warning' as const };
    }
    if (event === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED' || event === 'PAYMENT_REPROVED_BY_RISK_ANALYSIS') {
        if (preservedAccess) return { ...preservedAccess, checkoutStatus: 'payment_pending', effect: 'access_warning' as const };
        return { status: 'active', accessState: 'limited_access', checkoutStatus: 'payment_pending', effect: 'access_warning' as const };
    }
    if (event === 'PAYMENT_REFUNDED') {
        return { status: 'refunded', accessState: 'blocked', checkoutStatus: 'blocked', effect: 'access_blocked' as const };
    }
    if (event === 'PAYMENT_CHARGEBACK_REQUESTED' || event === 'PAYMENT_CHARGEBACK_DISPUTE') {
        return { status: 'chargeback', accessState: 'blocked', checkoutStatus: 'blocked', effect: 'access_blocked' as const };
    }
    if (event === 'PAYMENT_DELETED' || event === 'PAYMENT_BANK_SLIP_CANCELLED') {
        if (preservedAccess) return { ...preservedAccess, checkoutStatus: 'canceled' };
        return currentStatus === 'active' && currentAccessState === 'paid_access'
            ? { status: 'past_due', accessState: 'blocked', checkoutStatus: 'blocked', effect: 'access_blocked' as const }
            : { status: 'active', accessState: 'limited_access', checkoutStatus: 'canceled', effect: 'checkout_update' as const };
    }
    if (
        event === 'PAYMENT_CREATED' ||
        event === 'PAYMENT_UPDATED' ||
        event === 'PAYMENT_AWAITING_RISK_ANALYSIS' ||
        event === 'PAYMENT_AUTHORIZED' ||
        event === 'PAYMENT_ANTICIPATED' ||
        event === 'PAYMENT_APPROVED_BY_RISK_ANALYSIS'
    ) {
        if (alreadyPaymentBacked) {
            return { status: 'active', accessState: 'paid_access', checkoutStatus: 'payment_pending', effect: 'history_only' as const };
        }
        if (preservedAccess) return { ...preservedAccess, checkoutStatus: 'payment_pending' };
        return { status: 'active', accessState: 'limited_access', checkoutStatus: 'payment_pending', effect: 'checkout_update' as const };
    }
    if (preservedAccess) return { ...preservedAccess, checkoutStatus: 'updated' };
    return alreadyPaymentBacked
        ? {
            status: 'active',
            accessState: 'paid_access',
            checkoutStatus: 'updated',
            effect: event === 'PAYMENT_PARTIALLY_REFUNDED' ? 'access_warning' as const : 'history_only' as const,
        }
        : {
            status: 'active',
            accessState: 'limited_access',
            checkoutStatus: 'updated',
            effect: 'history_only' as const,
        };
}

async function applyPlatformTransition(args: {
    body: any;
    resource: any;
    event: string;
    context: any;
    status: string;
    accessState: string;
    checkoutStatus: string;
    effect: 'history_only' | 'checkout_update' | 'access_granted' | 'access_blocked' | 'access_warning' | 'error';
}) {
    const { body, resource, event, context, status, accessState, checkoutStatus, effect } = args;
    const now = new Date().toISOString();
    const eventAt = eventOccurredAt(body, resource);
    const providerPaymentId = getProviderPaymentId(body, resource);
    const providerCustomerId = getProviderCustomerId(body, resource);
    const providerSubscriptionId = context.providerSubscriptionId || context.checkoutSession?.provider_subscription_id || '';
    const providerCheckoutId = context.providerCheckoutId || context.checkoutSession?.provider_checkout_id || '';
    const current = context.userSubscription || await getSubscriptionByUserId(context.userId);
    const eventId = await recordPlatformSubscriptionEvent(body, resource, event, context, effect);

    if (context.checkoutSession?.id) {
        const { error: checkoutUpdateError } = await supabaseAdmin
            .from('subscription_checkout_sessions')
            .update({
                provider_checkout_id: providerCheckoutId || null,
                provider_subscription_id: providerSubscriptionId || null,
                provider_payment_id: providerPaymentId || context.checkoutSession.provider_payment_id || null,
                billing_type: getBillingType(resource),
                status: checkoutStatus,
                paid_at: checkoutStatus === 'paid' ? now : context.checkoutSession.paid_at || null,
                canceled_at: ['canceled', 'expired', 'blocked'].includes(checkoutStatus) ? now : context.checkoutSession.canceled_at || null,
                metadata: {
                    ...(context.checkoutSession.metadata || {}),
                    last_asaas_event: event,
                    last_event_at: eventAt,
                    last_payment_id: providerPaymentId || null,
                },
                updated_at: now,
            })
            .eq('id', context.checkoutSession.id);

        if (checkoutUpdateError) throw checkoutUpdateError;
    }

    const staleDowngrade = isOlderDowngrade(current, status, eventAt);
    if (staleDowngrade) {
        console.log(`[asaas-webhook] Ignoring stale platform downgrade ${event} for user ${context.userId}`);
        return true;
    }

    const grantsPaidAccess = status === 'active' && accessState === 'paid_access';
    const preservesExistingAccess = Boolean(
        current &&
        status === current.status &&
        accessState === current.access_state,
    );
    const nextPlan = grantsPaidAccess
        ? 'Professional'
        : preservesExistingAccess
            ? current.plan
            : 'Essential';
    const nextPlanCode = grantsPaidAccess
        ? 'professional'
        : preservesExistingAccess
            ? current.plan_code
            : 'essential';
    const nextValues: Record<string, unknown> = {
        plan: nextPlan,
        plan_code: nextPlanCode,
        status,
        access_state: accessState,
        asaas_customer_id: providerCustomerId || current?.asaas_customer_id || null,
        asaas_subscription_id: providerSubscriptionId || current?.asaas_subscription_id || null,
        asaas_checkout_id: providerCheckoutId || current?.asaas_checkout_id || null,
        last_payment_id: providerPaymentId || current?.last_payment_id || null,
        last_payment_status: storedPaymentStatusForEvent(event, resource),
        last_payment_event_at: eventAt,
        external_reference: context.externalReference || current?.external_reference || null,
        metadata: subscriptionMetadata({
            ...((current?.metadata || {}) as Record<string, unknown>),
            last_asaas_event: event,
            last_event_at: eventAt,
            checkout_external_reference: context.externalReference || null,
        }),
        status_version: Number(current?.status_version || 0) + 1,
        updated_at: now,
    };

    if (status === 'active') {
        nextValues.current_period_start = now;
        nextValues.current_period_end = subscriptionPeriodEnd(resource) || current?.current_period_end || null;
        nextValues.canceled_at = null;
        nextValues.blocked_at = null;
        nextValues.grace_period_ends_at = null;
    }

    if (['blocked', 'past_due', 'payment_pending', 'refunded', 'chargeback'].includes(status)) {
        nextValues.blocked_at = current?.blocked_at || now;
    }

    if (['canceled', 'refunded', 'chargeback'].includes(status)) {
        nextValues.canceled_at = current?.canceled_at || now;
    }

    const updated = await upsertUserSubscriptionByUserId(context.userId, nextValues);
    await auditPlatformAccessChange(context, eventId, `asaas_${event.toLowerCase()}`, current, status, accessState, event);

    if (status === 'active') {
        await markProfilePlan(context.userId, String(nextPlan));
    }

    await emitAsaasNotification({
        userId: context.userId,
        event,
        resource,
        objectType: inferProviderObjectType(body),
        actionUrl: '/ajustes?tab=pagamentos',
    });

    console.log(`[asaas-webhook] Platform billing synchronized (${event}): ${context.externalReference || providerSubscriptionId || providerPaymentId}`);
    context.userSubscription = updated;
    return true;
}

async function handlePlatformPaymentEvent(body: any, payment: any, event: string) {
    if (!payment) return false;
    const context = await resolvePlatformContext(body, payment);
    if (!context) return false;

    const transition = paymentTransitionForEvent(
        event,
        context.userSubscription?.status,
        context.userSubscription?.access_state,
        context.userSubscription,
    );
    await applyPlatformTransition({
        body,
        resource: payment,
        event,
        context,
        status: transition.status,
        accessState: transition.accessState,
        checkoutStatus: transition.checkoutStatus,
        effect: transition.effect,
    });
    return true;
}

async function handlePlatformSubscriptionEvent(body: any, resource: any, event: string) {
    const sourceResource = body?.subscription || body?.checkout || resource || {};
    const context = await resolvePlatformContext(body, sourceResource);
    if (!context) return;

    const providerStatus = String(sourceResource?.status || '').toUpperCase();
    const transition = subscriptionTransitionForEvent(
        event,
        providerStatus,
        context.userSubscription?.status,
        context.userSubscription?.access_state,
        context.userSubscription,
    );
    await applyPlatformTransition({
        body,
        resource: sourceResource,
        event,
        context,
        status: transition.status,
        accessState: transition.accessState,
        checkoutStatus: transition.checkoutStatus,
        effect: transition.effect,
    });
}
