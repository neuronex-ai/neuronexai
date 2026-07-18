import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { Transaction, PaymentMethod, TransactionOrigin } from '@/types';

export type FinancialEntryType = 'income' | 'expense';
export type FinancialEntryStatus = 'planned' | 'pending' | 'paid' | 'overdue' | 'cancelled';
export type FinancialEntryPaymentMethod =
  | 'manual'
  | 'pix'
  | 'boleto'
  | 'card'
  | 'cash'
  | 'external_transfer'
  | 'convenio'
  | 'other';

export interface FinancialEntry {
  id: string;
  clinic_id: string | null;
  professional_id: string;
  patient_id: string | null;
  appointment_id: string | null;
  type: FinancialEntryType;
  title: string;
  description: string | null;
  category_id: string | null;
  amount: number;
  due_date: string | null;
  competence_date: string | null;
  paid_at: string | null;
  status: FinancialEntryStatus;
  payment_method: FinancialEntryPaymentMethod;
  origin: string;
  neurofinance_transaction_id: string | null;
  neurofinance_charge_id: string | null;
  idempotency_key: string | null;
  reversal_of_entry_id: string | null;
  reversal_reason: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  patients?: {
    name: string;
    email: string | null;
  } | null;
  financial_categories?: { name: string } | null;
  financial_entry_settlements?: Array<{id:string;amount:number;settled_at:string;payment_method:FinancialEntryPaymentMethod;status:'posted'|'reversed'}>;
}

export interface FinancialCategory {
  id: string;
  clinic_id: string | null;
  professional_id: string;
  type: FinancialEntryType;
  name: string;
  color: string | null;
  icon: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialAutomationSettings {
  id: string;
  clinic_id: string | null;
  professional_id: string;
  appointment_auto_create_enabled: boolean;
  appointment_default_amount: number | null;
  appointment_default_category_id: string | null;
  appointment_due_days: number;
  attended_status_moves_to_pending: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialEntryFilters {
  startDate?: Date;
  endDate?: Date;
  type?: FinancialEntryType;
  status?: FinancialEntryStatus | FinancialEntryStatus[];
  patientId?: string;
  origin?: string;
  onlyPaid?: boolean;
  onlyOpen?: boolean;
  limit?: number;
}

export interface NewFinancialEntryInput {
  type: FinancialEntryType;
  title?: string;
  description: string;
  amount: number;
  dueDate: Date;
  competenceDate?: Date;
  paidAt?: Date | null;
  status?: FinancialEntryStatus;
  paymentMethod?: FinancialEntryPaymentMethod;
  origin?: string;
  categoryId?: string | null;
  patientId?: string | null;
  appointmentId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateFinancialEntryInput extends Partial<NewFinancialEntryInput> {
  id: string;
  paidAt?: Date | null;
  cancelledAt?: Date | null;
  cancelledReason?: string | null;
  reversalOfEntryId?: string | null;
  reversalReason?: string | null;
}
export type FinancialEntryTransitionAction='settle'|'cancel'|'reopen'|'reverse';
export interface FinancialEntryTransitionInput{id:string;action:FinancialEntryTransitionAction;amount?:number|null;effectiveAt?:Date;paymentMethod?:FinancialEntryPaymentMethod;reason?:string|null;idempotencyKey?:string|null}
export interface FinancialEntryTransitionResult{entry:FinancialEntry;settlement_id:string|null;reversal_id:string|null;settled_amount:number;remaining_amount:number}

export interface NewRecurringFinancialEntryInput {
  type: FinancialEntryType;
  title: string;
  amount: number;
  categoryId?: string | null;
  frequency: RecurringFinancialEntryFrequency;
  startDate: Date;
  endDate?: Date | null;
  scope: RecurringFinancialEntryScope;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}

export type RecurringFinancialEntryFrequency = 'weekly' | 'monthly' | 'yearly';
export type RecurringFinancialEntryScope = 'clinic' | 'personal';
export type RecurringFinancialEntryStatus = 'active' | 'paused' | 'finished' | 'cancelled';
export type RecurringFinancialEntryAction = 'pause' | 'resume' | 'finish';

export interface RecurringFinancialEntry {
  id: string;
  clinic_id: string | null;
  professional_id: string;
  type: FinancialEntryType;
  title: string;
  amount: number;
  category_id: string | null;
  frequency: RecurringFinancialEntryFrequency;
  start_date: string;
  end_date: string | null;
  next_generation_date: string | null;
  status: RecurringFinancialEntryStatus;
  idempotency_key: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringFinancialEntryFilters {
  status?: RecurringFinancialEntryStatus | RecurringFinancialEntryStatus[];
}

export interface UpdateRecurringFinancialEntryStatusInput {
  id: string;
  action: RecurringFinancialEntryAction;
}

export interface UpdateFinancialAutomationSettingsInput {
  appointmentAutoCreateEnabled: boolean;
  appointmentDefaultAmount?: number | null;
  appointmentDefaultCategoryId?: string | null;
  appointmentDueDays?: number;
  attendedStatusMovesToPending?: boolean;
  metadata?: Record<string, unknown>;
}

export interface FinancialMonthlyPoint {
  month: string;
  paidIncome: number;
  unpaidIncome: number;
  paidExpenses: number;
  unpaidExpenses: number;
  totalIncome: number;
  totalExpenses: number;
  result: number;
  convenioTotal: number;
  convenioPaid: number;
  convenioPending: number;
}

export interface FinancialSummary {
  incomePlanned: number;
  incomePaid: number;
  incomeUnpaid: number;
  expensePlanned: number;
  expensePaid: number;
  expenseUnpaid: number;
  resultPlanned: number;
  resultCurrent: number;
  overdueIncome: number;
  overdueCount: number;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const DEFAULT_FINANCIAL_CATEGORIES: Record<FinancialEntryType, { name: string; color: string; icon: string }[]> = {
  income: [
    { name: 'Sessao', color: '#18181b', icon: 'calendar-check' },
    { name: 'Cobranca Avulsa', color: '#10b981', icon: 'receipt' },
    { name: 'Mensalidade', color: '#059669', icon: 'repeat' },
    { name: 'Convenio', color: '#0f766e', icon: 'users' },
    { name: 'Comissao', color: '#52525b', icon: 'percent' },
    { name: 'Receitas não categorizadas', color: '#71717a', icon: 'wallet' },
  ],
  expense: [
    { name: 'Aluguel', color: '#18181b', icon: 'home' },
    { name: 'Agua', color: '#52525b', icon: 'droplet' },
    { name: 'Alimentacao', color: '#71717a', icon: 'utensils' },
    { name: 'Adiantamento', color: '#3f3f46', icon: 'arrow-up-right' },
    { name: 'Ajuste de caixa', color: '#27272a', icon: 'settings' },
    { name: 'Despesas não categorizadas', color: '#a1a1aa', icon: 'wallet' },
  ],
};

export function toFinancialPaymentMethod(method?: string | null): FinancialEntryPaymentMethod {
  switch (method) {
    case 'pix':
    case 'boleto':
      return method;
    case 'money':
    case 'cash':
      return 'cash';
    case 'credit_card':
    case 'debit_card':
    case 'card':
      return 'card';
    case 'external_transfer':
      return 'external_transfer';
    case 'convenio':
      return 'convenio';
    case 'manual':
      return 'manual';
    default:
      return 'other';
  }
}

export function fromFinancialPaymentMethod(method?: string | null): PaymentMethod {
  switch (method) {
    case 'pix':
    case 'boleto':
      return method;
    case 'cash':
      return 'money';
    case 'card':
      return 'credit_card';
    default:
      return 'mixed';
  }
}

export function toLegacyTransactionStatus(status?: string | null) {
  if (status === 'paid') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'pending';
}

export function fromLegacyTransactionStatus(status?: string | null): FinancialEntryStatus {
  if (['paid', 'completed', 'received'].includes(String(status || '').toLowerCase())) return 'paid';
  if (['cancelled', 'canceled'].includes(String(status || '').toLowerCase())) return 'cancelled';
  if (String(status || '').toLowerCase() === 'planned') return 'planned';
  if (String(status || '').toLowerCase() === 'overdue') return 'overdue';
  return 'pending';
}

export function financialEntryReferenceDate(entry: FinancialEntry) {
  return entry.paid_at?.slice(0, 10) || entry.competence_date || entry.due_date || entry.created_at.slice(0, 10);
}

function isOpenStatus(status: FinancialEntryStatus) {
  return ['planned', 'pending', 'overdue'].includes(status);
}

function isEntryInMonth(entry: FinancialEntry, year: number, month: number) {
  const reference = financialEntryReferenceDate(entry);
  return reference.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);
}

export function buildFinancialEntryIdempotencyKey(parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== '')
    .map((part) => String(part).trim().toLowerCase().replace(/\s+/g, '-'))
    .join(':');
}

const RECURRING_ACTION_STATUSES: Record<
  RecurringFinancialEntryAction,
  { next: RecurringFinancialEntryStatus; allowed: RecurringFinancialEntryStatus[] }
> = {
  pause: { next: 'paused', allowed: ['active', 'paused'] },
  resume: { next: 'active', allowed: ['paused', 'active'] },
  finish: { next: 'finished', allowed: ['active', 'paused', 'finished'] },
};

export function recurringFinancialEntryStatusForAction(action: RecurringFinancialEntryAction) {
  return RECURRING_ACTION_STATUSES[action].next;
}

export function recurringFinancialEntryAllowedStatusesForAction(action: RecurringFinancialEntryAction) {
  return [...RECURRING_ACTION_STATUSES[action].allowed];
}

export function recurringFinancialEntryScopeOf(
  entry: Pick<RecurringFinancialEntry, 'metadata'>,
): RecurringFinancialEntryScope {
  return entry.metadata?.scope === 'personal' ? 'personal' : 'clinic';
}

export function validateRecurringFinancialEntryInput(input: NewRecurringFinancialEntryInput) {
  if (!input.title.trim()) return 'Informe um título para a recorrência.';
  if (input.title.trim().length > 160) return 'Use um título com até 160 caracteres.';
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Informe um valor maior que zero.';
  if (Number.isNaN(input.startDate.getTime())) return 'Informe uma data inicial válida.';
  if (input.endDate && Number.isNaN(input.endDate.getTime())) return 'Informe uma data final válida.';
  if (input.endDate && format(input.endDate, 'yyyy-MM-dd') < format(input.startDate, 'yyyy-MM-dd')) {
    return 'A data final não pode ser anterior à data inicial.';
  }
  return null;
}

export function computeFinancialSummary(entries: FinancialEntry[], year: number, month: number): FinancialSummary {
  const monthEntries = entries.filter((entry) => entry.status !== 'cancelled' && isEntryInMonth(entry, year, month));
  const today = new Date().toISOString().slice(0, 10);

  return monthEntries.reduce<FinancialSummary>((summary, entry) => {
    const amount = Number(entry.amount || 0);
    const isPaid = entry.status === 'paid';
    const isOverdue = entry.type === 'income' && isOpenStatus(entry.status) && Boolean(entry.due_date) && String(entry.due_date) < today;

    if (entry.type === 'income') {
      summary.incomePlanned += amount;
      if (isPaid) summary.incomePaid += amount;
      else summary.incomeUnpaid += amount;
      if (isOverdue) {
        summary.overdueIncome += amount;
        summary.overdueCount += 1;
      }
    } else {
      summary.expensePlanned += amount;
      if (isPaid) summary.expensePaid += amount;
      else summary.expenseUnpaid += amount;
    }

    summary.resultPlanned = summary.incomePlanned - summary.expensePlanned;
    summary.resultCurrent = summary.incomePaid - summary.expensePaid;
    return summary;
  }, {
    incomePlanned: 0,
    incomePaid: 0,
    incomeUnpaid: 0,
    expensePlanned: 0,
    expensePaid: 0,
    expenseUnpaid: 0,
    resultPlanned: 0,
    resultCurrent: 0,
    overdueIncome: 0,
    overdueCount: 0,
  });
}

export function computeFinancialMonthlySeries(entries: FinancialEntry[], year: number): FinancialMonthlyPoint[] {
  return MONTHS.map((monthName, monthIndex) => {
    const monthEntries = entries.filter((entry) => entry.status !== 'cancelled' && isEntryInMonth(entry, year, monthIndex));
    const point = monthEntries.reduce<FinancialMonthlyPoint>((acc, entry) => {
      const amount = Number(entry.amount || 0);
      const isPaid = entry.status === 'paid';
      const isConvenio = entry.payment_method === 'convenio' || entry.origin === 'convenio';

      if (entry.type === 'income') {
        if (isPaid) acc.paidIncome += amount;
        else acc.unpaidIncome += amount;

        if (isConvenio) {
          acc.convenioTotal += amount;
          if (isPaid) acc.convenioPaid += amount;
          else acc.convenioPending += amount;
        }
      } else if (isPaid) {
        acc.paidExpenses += amount;
      } else {
        acc.unpaidExpenses += amount;
      }

      acc.totalIncome = acc.paidIncome + acc.unpaidIncome;
      acc.totalExpenses = acc.paidExpenses + acc.unpaidExpenses;
      acc.result = acc.totalIncome - acc.totalExpenses;
      return acc;
    }, {
      month: monthName,
      paidIncome: 0,
      unpaidIncome: 0,
      paidExpenses: 0,
      unpaidExpenses: 0,
      totalIncome: 0,
      totalExpenses: 0,
      result: 0,
      convenioTotal: 0,
      convenioPaid: 0,
      convenioPending: 0,
    });

    return point;
  });
}

export function mapFinancialEntryToTransaction(entry: FinancialEntry): Transaction {
  const metadata = entry.metadata || {};
  const transactionMetadata = {
    ...metadata,
    financial_entry_id: entry.id,
    financial_entry_status: entry.status,
    due_date: entry.due_date,
    competence_date: entry.competence_date,
    paid_at: entry.paid_at,
    financial_entry_origin: entry.origin,
    financial_entry_payment_method: entry.payment_method,
    neurofinance_charge_id: entry.neurofinance_charge_id,
    neurofinance_transaction_id: entry.neurofinance_transaction_id,
    reversal_of_entry_id: entry.reversal_of_entry_id,
    settlements:(entry.financial_entry_settlements||[]).map(s=>({id:s.id,amount:Number(s.amount),settled_at:s.settled_at,payment_method:s.payment_method,status:s.status})),
  };
  const date =
    entry.paid_at?.slice(0, 10) ||
    entry.competence_date ||
    entry.due_date ||
    entry.created_at.slice(0, 10);

  return {
    id: entry.id,
    user_id: entry.professional_id,
    description: entry.description || entry.title,
    amount: Number(entry.amount || 0),
    type: entry.type,
    category: entry.financial_categories?.name || (typeof metadata.category === 'string' ? metadata.category : null),
    date,
    appointment_id: entry.appointment_id,
    created_at: entry.created_at,
    payment_method: fromFinancialPaymentMethod(entry.payment_method),
    installments: typeof metadata.installments === 'number' ? metadata.installments : undefined,
    package_id: typeof metadata.package_id === 'string' ? metadata.package_id : undefined,
    external_reference: typeof metadata.external_reference === 'string' ? metadata.external_reference : entry.neurofinance_charge_id || undefined,
    attachment_url: typeof metadata.attachment_url === 'string' ? metadata.attachment_url : undefined,
    origin: (entry.origin === 'neurofinance' ? 'gateway_auto' : 'manual') as TransactionOrigin,
    patient_id: entry.patient_id || undefined,
    patient_name: entry.patients?.name,
    status: toLegacyTransactionStatus(entry.status),
    metadata: transactionMetadata,
    patients: entry.patients || null,
  };
}

export async function fetchFinancialEntries(userId: string, filters: FinancialEntryFilters = {}) {
  let query = supabase
    .from('financial_entries')
    .select('*, patients(name, email), financial_categories(name), financial_entry_settlements(id, amount, settled_at, payment_method, status)')
    .eq('professional_id', userId)
    .order('due_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(filters.limit || 500);

  if (filters.startDate) {
    query = query.gte('due_date', format(filters.startDate, 'yyyy-MM-dd'));
  }

  if (filters.endDate) {
    query = query.lte('due_date', format(filters.endDate, 'yyyy-MM-dd'));
  }

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }

  if (filters.patientId) {
    query = query.eq('patient_id', filters.patientId);
  }

  if (filters.origin) {
    query = query.eq('origin', filters.origin);
  }

  if (filters.onlyPaid) {
    query = query.eq('status', 'paid');
  }

  if (filters.onlyOpen) {
    query = query.in('status', ['planned', 'pending', 'overdue']);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as FinancialEntry[];
}

async function seedDefaultFinancialCategories(userId: string, type?: FinancialEntryType) {
  const types: FinancialEntryType[] = type ? [type] : ['income', 'expense'];
  const rows = types.flatMap((categoryType) =>
    DEFAULT_FINANCIAL_CATEGORIES[categoryType].map((category) => ({
      professional_id: userId,
      type: categoryType,
      name: category.name,
      color: category.color,
      icon: category.icon,
      is_default: true,
    }))
  );

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('financial_categories')
    .insert(rows);

  if (error && !String(error.message || '').toLowerCase().includes('duplicate')) {
    throw error;
  }
}

export async function fetchFinancialCategories(userId: string, type?: FinancialEntryType) {
  let query = supabase
    .from('financial_categories')
    .select('*')
    .eq('professional_id', userId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) throw error;

  if ((data || []).length === 0) {
    await seedDefaultFinancialCategories(userId, type);

    let seededQuery = supabase
      .from('financial_categories')
      .select('*')
      .eq('professional_id', userId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (type) seededQuery = seededQuery.eq('type', type);

    const { data: seededData, error: seededError } = await seededQuery;
    if (seededError) throw seededError;
    return (seededData || []) as FinancialCategory[];
  }

  return (data || []) as FinancialCategory[];
}

export async function fetchFinancialAutomationSettings(userId: string) {
  const { data, error } = await supabase
    .from('financial_automation_settings')
    .select('*')
    .eq('professional_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as FinancialAutomationSettings | null;
}

export function useFinancialCategories(type?: FinancialEntryType) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<FinancialCategory[], Error>({
    queryKey: ['financialCategories', userId, type || 'all'],
    queryFn: () => {
      if (!userId) throw new Error('Usuário não autenticado');
      return fetchFinancialCategories(userId, type);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}

export function useCreateFinancialCategory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ type, name }: { type: FinancialEntryType; name: string }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      const normalizedName = name.trim();
      if (!normalizedName) throw new Error('Informe o nome da categoria');

      const { data, error } = await supabase
        .from('financial_categories')
        .insert({
          professional_id: user.id,
          type,
          name: normalizedName,
          color: type === 'income' ? '#18181b' : '#52525b',
          icon: type === 'income' ? 'receipt' : 'wallet',
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as FinancialCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialCategories'] });
    },
  });
}

export function useFinancialAutomationSettings() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<FinancialAutomationSettings | null, Error>({
    queryKey: ['financialAutomationSettings', userId],
    queryFn: () => {
      if (!userId) throw new Error('Usuário não autenticado');
      return fetchFinancialAutomationSettings(userId);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

export function useSaveFinancialAutomationSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateFinancialAutomationSettingsInput) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const payload = {
        professional_id: user.id,
        appointment_auto_create_enabled: input.appointmentAutoCreateEnabled,
        appointment_default_amount: input.appointmentDefaultAmount ?? null,
        appointment_default_category_id: input.appointmentDefaultCategoryId || null,
        appointment_due_days: Math.max(0, Number(input.appointmentDueDays ?? 0)),
        attended_status_moves_to_pending: input.attendedStatusMovesToPending ?? true,
        metadata: input.metadata || {},
      };

      const existing = await fetchFinancialAutomationSettings(user.id);
      const query = existing
        ? supabase
            .from('financial_automation_settings')
            .update(payload)
            .eq('id', existing.id)
            .eq('professional_id', user.id)
            .select()
            .single()
        : supabase
            .from('financial_automation_settings')
            .insert(payload)
            .select()
            .single();

      const { data, error } = await query;
      if (error) throw error;
      return data as FinancialAutomationSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialAutomationSettings'] });
    },
  });
}

export function useFinancialSummary(year: number, month: number) {
  const { data: entries = [], ...query } = useFinancialEntries({ limit: 5000 });

  return {
    ...query,
    data: computeFinancialSummary(entries, year, month),
    entries,
    chartData: computeFinancialMonthlySeries(entries, year),
  };
}

export function useFinancialEntries(filters: FinancialEntryFilters = {}) {
  const { user } = useAuth();
  const userId = user?.id;
  const startStr = filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : 'all';
  const endStr = filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : 'all';

  return useQuery<FinancialEntry[], Error>({
    queryKey: [
      'financialEntries',
      userId,
      startStr,
      endStr,
      filters.type || 'all',
      Array.isArray(filters.status) ? filters.status.join(',') : filters.status || 'all',
      filters.patientId || 'all',
      filters.origin || 'all',
      filters.onlyPaid ? 'paid' : 'all',
      filters.onlyOpen ? 'open' : 'all',
      filters.limit || 500,
    ],
    queryFn: () => {
      if (!userId) throw new Error('Usuário não autenticado');
      return fetchFinancialEntries(userId, filters);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
    retry: false,
  });
}

export async function fetchRecurringFinancialEntries(
  professionalId: string,
  filters: RecurringFinancialEntryFilters = {},
) {
  let query = supabase
    .from('recurring_financial_entries')
    .select('*')
    .eq('professional_id', professionalId);

  if (Array.isArray(filters.status) && filters.status.length > 0) {
    query = query.in('status', filters.status);
  } else if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query
    .order('next_generation_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as RecurringFinancialEntry[];
}

export function useRecurringFinancialEntries(filters: RecurringFinancialEntryFilters = {}) {
  const { user } = useAuth();
  const userId = user?.id;
  const statusKey = Array.isArray(filters.status)
    ? filters.status.join(',')
    : filters.status || 'all';

  return useQuery<RecurringFinancialEntry[], Error>({
    queryKey: ['recurringFinancialEntries', userId, statusKey],
    queryFn: () => {
      if (!userId) throw new Error('Usuário não autenticado');
      return fetchRecurringFinancialEntries(userId, filters);
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60,
    retry: false,
  });
}

export function useCreateFinancialEntry() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewFinancialEntryInput) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const status = input.status || (input.paidAt ? 'paid' : 'pending');
      const paidAt = input.paidAt ? input.paidAt.toISOString() : null;
      const idempotencyKey = input.idempotencyKey || null;

      const { data, error } = await supabase
        .from('financial_entries')
        .insert({
          professional_id: user.id,
          type: input.type,
          title: input.title || input.description,
          description: input.description,
          category_id: input.categoryId || null,
          amount: Math.abs(Number(input.amount || 0)),
          due_date: format(input.dueDate, 'yyyy-MM-dd'),
          competence_date: format(input.competenceDate || input.dueDate, 'yyyy-MM-dd'),
          paid_at: paidAt,
          status,
          payment_method: input.paymentMethod || 'manual',
          origin: input.origin || 'manual',
          patient_id: input.patientId || null,
          appointment_id: input.appointmentId || null,
          idempotency_key: idempotencyKey,
          metadata: input.metadata || {},
        })
        .select()
        .single();

      if (error) {
        const isIdempotencyConflict = error.code === '23505' && Boolean(idempotencyKey);

        if (isIdempotencyConflict) {
          const { data: existing, error: existingError } = await supabase
            .from('financial_entries')
            .select()
            .eq('professional_id', user.id)
            .eq('idempotency_key', idempotencyKey!)
            .single();

          if (!existingError && existing) return existing as FinancialEntry;
        }

        throw error;
      }
      return data as FinancialEntry;
    },
    onSuccess: () => {
      [
        'financialEntries',
        'transactions',
        'patientTransactions',
        'financialMetrics',
        'advancedCashFlow',
        'projected-cash-flow-v5',
        'charges-page',
        'dashboard-managerial-metrics',
      ].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    },
  });
}

export function useCreateRecurringFinancialEntry() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewRecurringFinancialEntryInput) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const validationMessage = validateRecurringFinancialEntryInput(input);
      if (validationMessage) throw new Error(validationMessage);

      const { data, error } = await supabase
        .from('recurring_financial_entries')
        .insert({
          professional_id: user.id,
          type: input.type,
          title: input.title.trim(),
          amount: Math.abs(Number(input.amount || 0)),
          category_id: input.categoryId || null,
          frequency: input.frequency,
          start_date: format(input.startDate, 'yyyy-MM-dd'),
          end_date: input.endDate ? format(input.endDate, 'yyyy-MM-dd') : null,
          next_generation_date: format(input.startDate, 'yyyy-MM-dd'),
          status: 'active',
          idempotency_key: input.idempotencyKey || buildFinancialEntryIdempotencyKey([
            'recurring',
            user.id,
            input.type,
            input.frequency,
            input.title,
            format(input.startDate, 'yyyy-MM-dd'),
          ]),
          metadata: {
            ...(input.metadata || {}),
            scope: input.scope,
          },
        })
        .select()
        .single();

      if (error) throw error;
      return data as RecurringFinancialEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringFinancialEntries'] });
      queryClient.invalidateQueries({ queryKey: ['financialEntries'] });
    },
  });
}

export async function updateRecurringFinancialEntryStatus(
  professionalId: string,
  input: UpdateRecurringFinancialEntryStatusInput,
) {
  const status = recurringFinancialEntryStatusForAction(input.action);
  const allowedStatuses = recurringFinancialEntryAllowedStatusesForAction(input.action);
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (input.action === 'finish') patch.next_generation_date = null;

  const { data, error } = await supabase
    .from('recurring_financial_entries')
    .update(patch)
    .eq('id', input.id)
    .eq('professional_id', professionalId)
    .in('status', allowedStatuses)
    .select()
    .single();

  if (error) {
    throw new Error('Não foi possível atualizar esta recorrência. Recarregue a lista e tente novamente.');
  }

  return data as RecurringFinancialEntry;
}

export function useUpdateRecurringFinancialEntryStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<
    RecurringFinancialEntry,
    Error,
    UpdateRecurringFinancialEntryStatusInput
  >({
    mutationFn: async (input) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      return updateRecurringFinancialEntryStatus(user.id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringFinancialEntries'] });
      queryClient.invalidateQueries({ queryKey: ['financialEntries'] });
      queryClient.invalidateQueries({ queryKey: ['projected-cash-flow-v5'] });
    },
  });
}

function serializeFinancialEntryPatch(input: UpdateFinancialEntryInput) {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) {
    patch.description = input.description;
    if (input.title === undefined) patch.title = input.description;
  }
  if (input.type !== undefined) patch.type = input.type;
  if (input.amount !== undefined) patch.amount = Math.abs(Number(input.amount || 0));
  if (input.dueDate !== undefined) patch.due_date = format(input.dueDate, 'yyyy-MM-dd');
  if (input.competenceDate !== undefined) patch.competence_date = format(input.competenceDate, 'yyyy-MM-dd');
  if (input.paidAt !== undefined) patch.paid_at = input.paidAt ? input.paidAt.toISOString() : null;
  if (input.status !== undefined) patch.status = input.status;
  if (input.paymentMethod !== undefined) patch.payment_method = input.paymentMethod;
  if (input.origin !== undefined) patch.origin = input.origin;
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.patientId !== undefined) patch.patient_id = input.patientId;
  if (input.appointmentId !== undefined) patch.appointment_id = input.appointmentId;
  if (input.idempotencyKey !== undefined) patch.idempotency_key = input.idempotencyKey;
  if (input.cancelledAt !== undefined) patch.cancelled_at = input.cancelledAt ? input.cancelledAt.toISOString() : null;
  if (input.cancelledReason !== undefined) patch.cancelled_reason = input.cancelledReason;
  if (input.reversalOfEntryId !== undefined) patch.reversal_of_entry_id = input.reversalOfEntryId;
  if (input.reversalReason !== undefined) patch.reversal_reason = input.reversalReason;
  if (input.metadata !== undefined) patch.metadata = input.metadata;

  return patch;
}

export function useUpdateFinancialEntry() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateFinancialEntryInput) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('financial_entries')
        .update(serializeFinancialEntryPatch(input))
        .eq('id', input.id)
        .eq('professional_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data as FinancialEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialEntries'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['patientTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
    },
  });
}

export function useTransitionFinancialEntry(){
  const {user}=useAuth();const queryClient=useQueryClient();
  return useMutation<FinancialEntryTransitionResult,Error,FinancialEntryTransitionInput>({
    mutationFn:async(input)=>{if(!user?.id)throw new Error('Usuário não autenticado');const{data,error}=await(supabase as any).rpc('transition_financial_entry',{p_entry_id:input.id,p_action:input.action,p_amount:input.amount??null,p_effective_at:(input.effectiveAt||new Date()).toISOString(),p_payment_method:input.paymentMethod||'manual',p_reason:input.reason?.trim()||null,p_idempotency_key:input.idempotencyKey||null});if(error)throw error;return data as FinancialEntryTransitionResult;},
    onSuccess:()=>{['financialEntries','financialEntrySettlements','transactions','patientTransactions','financialMetrics','advancedCashFlow','charges-page'].forEach(key=>queryClient.invalidateQueries({queryKey:[key]}));},
  });
}

export function useDeleteFinancialEntries() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      if (ids.length === 0) return [];

      const { data: rows, error: fetchError } = await supabase
        .from('financial_entries')
        .select('id,status,origin,appointment_id,neurofinance_charge_id,neurofinance_transaction_id')
        .eq('professional_id', user.id)
        .in('id', ids);

      if (fetchError) throw fetchError;

      const entries = rows || [];
      const hardDeleteIds = entries
        .filter((entry) =>
          entry.status !== 'paid' &&
          entry.origin === 'manual' &&
          !entry.appointment_id &&
          !entry.neurofinance_charge_id &&
          !entry.neurofinance_transaction_id
        )
        .map((entry) => entry.id);

      const cancelIds = entries
        .filter((entry) => !hardDeleteIds.includes(entry.id))
        .map((entry) => entry.id);

      let deleted: Array<{ id: string }> = [];
      if (hardDeleteIds.length > 0) {
        const { data, error } = await supabase
          .from('financial_entries')
          .delete()
          .eq('professional_id', user.id)
          .in('id', hardDeleteIds)
          .select('id');

        if (error) throw error;
        deleted = data || [];
      }

      let cancelled: Array<{ id: string }> = [];
      if (cancelIds.length > 0) {
        const { data, error } = await supabase
          .from('financial_entries')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancelled_reason: 'user_delete_request',
            updated_at: new Date().toISOString(),
          })
          .eq('professional_id', user.id)
          .in('id', cancelIds)
          .select('id');

        if (error) throw error;
        cancelled = data || [];
      }

      return [...deleted, ...cancelled];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialEntries'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['patientTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
    },
  });
}

export function useCancelFinancialEntry() {
  const transition = useTransitionFinancialEntry();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => transition.mutateAsync({id,action:'cancel',reason,idempotencyKey:buildFinancialEntryIdempotencyKey(['cancel',id,reason])}),
  });
}

export function useHardDeleteFinancialEntriesUnsafe() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from('financial_entries')
        .delete()
        .eq('professional_id', user.id)
        .in('id', ids)
        .select('id');

      if (error) throw error;
      return data || [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialEntries'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['patientTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
    },
  });
}

export function useMarkFinancialEntryPaid() {
  const transition = useTransitionFinancialEntry();

  return useMutation({
    mutationFn: async ({ id, amount, paidAt = new Date(), paymentMethod = 'manual', idempotencyKey }: {
      id: string;
      amount?:number;
      paidAt?: Date;
      paymentMethod?: FinancialEntryPaymentMethod;
      idempotencyKey?:string;
    }) => transition.mutateAsync({id,action:'settle',amount,effectiveAt:paidAt,paymentMethod,idempotencyKey}),
  });
}
