import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Briefcase,
    Building2,
    Camera,
    CheckCircle2,
    FileUp,
    KeyRound,
    Loader2,
    MapPin,
    Pencil,
    ShieldCheck,
    Upload,
    User,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TermsOfUseModal } from "./TermsOfUseModal";
import { useAddressAutocomplete, type AddressSuggestion, type ValidatedAddress } from "@/hooks/use-address-autocomplete";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { useNeuroFinanceTariffs } from "@/hooks/use-neurofinance-tariffs";
import { useProfile } from "@/hooks/use-profile";
import { AsaasStamp } from "./AsaasStamp";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { NeuroFinanceCardVisual } from "@/components/landing/Feature3DVisuals";
import { formatPixKeyInput, normalizePixKeyInput, type PixKeyInputType } from "@/lib/financial-input";
import type { TariffRule } from "@/lib/neurofinance-types";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

interface CustomOnboardingFlowProps {
    onComplete: () => void;
    onCancel?: () => void;
    fullScreen?: boolean;
}

type Step =
    | "personal"
    | "business"
    | "banking"
    | "verification"
    | "review"
    | "success";

type PepValue = "none" | "existing";
type PayoutMethod = "pix" | "bank" | "both";
type TaxpayerType = "pf" | "pj";

type FormData = {
    firstName: string;
    lastName: string;
    taxpayerType: TaxpayerType;
    cpf: string;
    birthDate: string;
    phone: string;
    pep: PepValue;

    cep: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;

    companyType: string;           // Asaas: MEI, LIMITED, INDIVIDUAL, ASSOCIATION
    incomeValue: string;           // Asaas: faturamento mensal
    businessUrl: string;
    businessDescription: string;

    bankCode: string;
    agency: string;
    accountNumber: string;
    payoutMethod: PayoutMethod;
    pixKeyType: PixKeyInputType;
    pixKey: string;

    tosAccepted: boolean;
};

type UploadedDocIds = {
    front?: string;
    back?: string;
};

const INITIAL_FORM: FormData = {
    firstName: "",
    lastName: "",
    taxpayerType: "pf",
    cpf: "",
    birthDate: "",
    phone: "",
    pep: "none",

    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",

    companyType: "INDIVIDUAL",
    incomeValue: "",
    businessUrl: "",
    businessDescription: "Serviços de psicologia e saúde mental",

    bankCode: "",
    agency: "",
    accountNumber: "",
    payoutMethod: "pix",
    pixKeyType: "cpf",
    pixKey: "",

    tosAccepted: false,
};

const PIX_KEY_TYPES: Array<{ value: PixKeyInputType; label: string; hint: string }> = [
    { value: "cpf", label: "CPF", hint: "000.000.000-00" },
    { value: "cnpj", label: "CNPJ", hint: "00.000.000/0000-00" },
    { value: "email", label: "E-mail", hint: "voce@email.com" },
    { value: "telefone", label: "Telefone", hint: "+55 (00) 00000-0000" },
    { value: "evp", label: "Aleatória", hint: "Chave aleatória Pix" },
];

const payoutMethodOptions: Array<{ id: PayoutMethod; title: string; description: string; icon: React.ElementType }> = [
    { id: "pix", title: "Chave Pix", description: "Mais simples para receber repasses.", icon: KeyRound },
    { id: "bank", title: "Conta bancária", description: "Agência e conta de mesma titularidade.", icon: Building2 },
    { id: "both", title: "Pix + banco", description: "Deixe os dois destinos prontos.", icon: ShieldCheck },
];

const fallbackPaymentFees = [
    { key: "pix", title: "Pix", price: "Tabela vigente", settlement: "Instantâneo" },
    { key: "boleto", title: "Boleto", price: "Tabela vigente", settlement: "1 a 2 dias úteis" },
    { key: "credit", title: "Cartão crédito", price: "Tabela vigente", settlement: "Conforme parcela" },
    { key: "debit", title: "Cartão débito", price: "Tabela vigente", settlement: "Até 1 dia útil" },
];

function resolveTariff(ruleSet: TariffRule[], matcher: (rule: TariffRule) => boolean) {
    return ruleSet.find(matcher);
}

function buildPaymentFeeCards(ruleSet: TariffRule[] = []) {
    const findByTerms = (...terms: string[]) =>
        resolveTariff(ruleSet, (rule) => {
            const haystack = [
                rule.code,
                rule.category,
                rule.operation,
                rule.payment_method,
                rule.display_name,
                rule.description,
            ].join(" ").toLowerCase();
            return terms.every((term) => haystack.includes(term));
        });

    const mapped = [
        { ...fallbackPaymentFees[0], rule: findByTerms("pix") },
        { ...fallbackPaymentFees[1], rule: findByTerms("boleto") },
        { ...fallbackPaymentFees[2], rule: findByTerms("cart") || findByTerms("credit") || findByTerms("crédito") },
        { ...fallbackPaymentFees[3], rule: findByTerms("deb") || findByTerms("débito") },
    ];

    return mapped.map((item) => ({
        ...item,
        price: item.rule?.price_label || item.price,
        settlement: item.rule?.settlement_label || item.settlement,
    }));
}

function coercePixKeyType(value: unknown): PixKeyInputType {
    const normalized = String(value || "").toLowerCase();
    return ["cpf", "cnpj", "email", "telefone", "evp"].includes(normalized)
        ? (normalized as PixKeyInputType)
        : "cpf";
}

function onlyDigits(value: string) {
    return value.replace(/\D/g, "");
}

function maskCpf(value: string) {
    return onlyDigits(value)
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
        .slice(0, 14);
}

function maskCnpj(value: string) {
    return onlyDigits(value)
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
        .slice(0, 18);
}

function maskCpfCnpj(value: string, taxpayerType: TaxpayerType) {
    return taxpayerType === "pj" ? maskCnpj(value) : maskCpf(value);
}

function maskPhone(value: string) {
    return onlyDigits(value)
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{5})(\d)/, "$1-$2")
        .slice(0, 15);
}

function maskCep(value: string) {
    return onlyDigits(value).replace(/(\d{5})(\d)/, "$1-$2").slice(0, 9);
}

function validateCpf(cpf: string) {
    return onlyDigits(cpf).length === 11;
}

function validateCnpj(cnpj: string) {
    return onlyDigits(cnpj).length === 14;
}

function maskBankCode(value: string) {
    return onlyDigits(value).slice(0, 3);
}

function maskAgency(value: string) {
    const digits = onlyDigits(value).slice(0, 6);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function maskAccountNumber(value: string) {
    const digits = onlyDigits(value).slice(0, 14);
    if (digits.length <= 1) return digits;
    if (digits.length <= 8) return digits.replace(/(\d+)(\d)$/, "$1-$2");
    return `${digits.slice(0, -1)}-${digits.slice(-1)}`;
}

function validateBirthDate(value: string) {
    if (!value) return false;
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return false;
    return year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function firstString(...values: unknown[]) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value.trim();
        if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
    return "";
}

function splitFullName(value: unknown) {
    const parts = firstString(value).split(/\s+/).filter(Boolean);
    return {
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" "),
    };
}

function applyValidatedAddressToForm(
    previous: FormData,
    address: ValidatedAddress,
): FormData {
    return {
        ...previous,
        cep: maskCep(address.postalCode || previous.cep),
        street: address.street || previous.street,
        number: address.number || previous.number,
        neighborhood: address.neighborhood || previous.neighborhood,
        city: address.city || previous.city,
        state: (address.state || previous.state).toUpperCase().slice(0, 2),
    };
}


function normalizeBusinessUrl(url: string) {
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function parseIncomeValue(value: string): number {
    if (!value) return 0;
    // Handle BR format: "5.000,00" -> 5000.00, or plain "5000" -> 5000
    return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

function buildOnboardingPayload(
    formData: FormData,
    docs: UploadedDocIds
): Record<string, unknown> {
    const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();

    // Payload aligned with Asaas POST /v3/accounts fields
    return {
        // Asaas subconta fields
        name: fullName,
        email: '', // Will be filled from user session in the edge function
        cpfCnpj: onlyDigits(formData.cpf),
        birthDate: formData.birthDate, // YYYY-MM-DD
        mobilePhone: onlyDigits(formData.phone),
        companyType: formData.companyType || undefined,
        incomeValue: parseIncomeValue(formData.incomeValue) || undefined,
        // Address fields (Asaas format)
        address: formData.street.trim(),
        addressNumber: formData.number.trim(),
        complement: formData.complement.trim() || undefined,
        province: formData.neighborhood.trim(), // Asaas calls it 'province'
        postalCode: onlyDigits(formData.cep),
        // Business info
        site: normalizeBusinessUrl(formData.businessUrl) || undefined,
        // Profile extras for internal use
        profile: {
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim(),
            taxpayer_type: formData.taxpayerType,
            political_exposure: formData.pep,
            city: formData.city.trim(),
            state: formData.state.trim().toUpperCase(),
        },
        business_profile: {
            mcc: "8099",
            product_description: formData.businessDescription.trim(),
        },
        bank_account: {
            country: "BR",
            currency: "brl",
            account_holder_type: "individual",
            account_holder_name: fullName,
            cpfCnpj: onlyDigits(formData.cpf),
            bank_code: onlyDigits(formData.bankCode),
            agency: onlyDigits(formData.agency),
            account_number: onlyDigits(formData.accountNumber),
            account_type: "CONTA_CORRENTE",
        },
        pix_destination: formData.pixKey.trim()
            ? {
                type: formData.pixKeyType,
                key: formData.pixKey.trim(),
                normalized_key: normalizePixKeyInput(formData.pixKey, formData.pixKeyType),
            }
            : null,
        payout_destination: formData.payoutMethod,
        documents: {
            front_file_id: docs.front || null,
            back_file_id: docs.back || null,
        },
        tos: {
            accepted: formData.tosAccepted,
        },
    };
}

function GlassCard({
    title,
    subtitle,
    icon,
    children,
}: {
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="relative overflow-hidden rounded-[32px] border border-black/[0.08] bg-white/[0.86] p-5 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.32)] backdrop-blur-3xl transition-[border-color,box-shadow,transform] duration-500 sm:p-6 dark:border-white/[0.08] dark:bg-[#111111]/[0.86] dark:shadow-[0_24px_70px_-42px_rgba(0,0,0,0.9)]">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-multiply dark:mix-blend-screen"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E\")" }}
            />
            <div className="relative z-10 mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-black/5 bg-black/[0.025] text-zinc-900 backdrop-blur-xl dark:border-white/5 dark:bg-white/[0.03] dark:text-white">
                    {icon}
                </div>
                <div>
                    <h2 className="text-base font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                        {title}
                    </h2>
                    {subtitle ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
                    ) : null}
                </div>
            </div>
            <div className="relative z-10">{children}</div>
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {children}
        </Label>
    );
}

function BrandComplianceStrip({ className }: { className?: string }) {
    return (
        <div className={cn(
            "inline-flex items-center gap-3 rounded-full border border-black/10 bg-white/70 px-3 py-2 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]",
            className
        )}>
            <span className="inline-flex items-center gap-2">
                <img src="/favicon-dark.png" alt="" className="h-5 w-5 dark:hidden" />
                <img src="/favicon-light.png" alt="" className="hidden h-5 w-5 dark:block" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-950 dark:text-white">
                    NeuroNex
                </span>
            </span>
            <span className="h-4 w-px bg-black/10 dark:bg-white/15" aria-hidden />
            <AsaasStamp className="scale-[0.78] origin-left opacity-75 hover:opacity-100" />
        </div>
    );
}

function PaymentFeesPreview({
    items,
}: {
    items: Array<{
        key: string;
        title: string;
        price: string;
        settlement: string;
    }>;
}) {
    return (
        <div className="rounded-[28px] border border-black/10 bg-white/55 p-4 shadow-[0_18px_54px_-48px_rgba(0,0,0,0.45)] dark:border-white/10 dark:bg-white/[0.035]">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Taxas e liquidação
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Resumo para cobranças geradas pelo NeuroFinance.
                    </p>
                </div>
                <ShieldCheck className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {items.map((item) => {
                    return (
                        <div
                            key={item.key}
                            className="rounded-[20px] border border-black/10 bg-[#f8f8f6] p-3.5 dark:border-white/10 dark:bg-black/30"
                        >
                            <span className="block min-h-8 text-[10px] font-black uppercase leading-tight tracking-[0.16em] text-zinc-400">
                                {item.settlement}
                            </span>
                            <p className="text-sm font-black text-zinc-950 dark:text-white">{item.title}</p>
                            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{item.price}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function AddressSuggestionList({
    suggestions,
    loading,
    error,
    onSelect,
}: {
    suggestions: AddressSuggestion[];
    loading: boolean;
    error?: string | null;
    onSelect: (suggestion: AddressSuggestion) => void;
}) {
    if (!loading && !error && suggestions.length === 0) return null;

    return (
        <div className="rounded-[20px] border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
            {loading ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Buscando endereço...
                </div>
            ) : null}

            {!loading && suggestions.length > 0 ? (
                <div className="space-y-2">
                    {suggestions.map((suggestion) => (
                        <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => onSelect(suggestion)}
                            className="flex w-full items-start gap-3 rounded-[16px] border border-black/5 bg-black/[0.025] px-3 py-2 text-left transition hover:bg-black/[0.045] dark:border-white/5 dark:bg-white/[0.035] dark:hover:bg-white/[0.06]"
                        >
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                            <span className="min-w-0">
                                <span className="block text-sm font-bold text-zinc-950 dark:text-white">
                                    {suggestion.label}
                                </span>
                                <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                                    {suggestion.source === "google"
                                        ? "Sugestão validada"
                                        : suggestion.source === "viacep"
                                            ? "CEP encontrado"
                                            : "Usar endereço digitado"}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            ) : null}

            {!loading && error ? (
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {error}
                </p>
            ) : null}
        </div>
    );
}

export const CustomOnboardingFlow = ({
    onComplete,
    onCancel,
    fullScreen = false,
}: CustomOnboardingFlowProps) => {
    const [step, setStep] = useState<Step>("personal");
    const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [uploadedDocIds, setUploadedDocIds] = useState<UploadedDocIds>({});
    const [files, setFiles] = useState<{ front: File | null; back: File | null }>({
        front: null,
        back: null,
    });
    const [selectedAddressQuery, setSelectedAddressQuery] = useState("");
    const [autoAppliedCep, setAutoAppliedCep] = useState("");

    const fileInputFrontRef = useRef<HTMLInputElement>(null);
    const fileInputBackRef = useRef<HTMLInputElement>(null);
    const hasPrefilledRef = useRef(false);
    const { user } = useAuth();
    const { profile: userProfile, isLoading: profileLoading } = useProfile();
    const { data: tariffRules = [] } = useNeuroFinanceTariffs();
    const paymentFeeCards = useMemo(() => buildPaymentFeeCards(tariffRules), [tariffRules]);

    const {
        account,
        startOnboarding,
        updateAccount,
        uploadFile,
        syncAccount,
        isLoading: accountLoading,
    } = useFinancialAccount();

    const addressLookupQuery = useMemo(() => {
        const cepDigits = onlyDigits(formData.cep);
        if (cepDigits.length >= 8) return cepDigits;
        return formData.street.trim();
    }, [formData.cep, formData.street]);

    const {
        suggestions: addressSuggestions,
        isLoading: addressLoading,
        isValidating: addressValidating,
        error: addressError,
        validateSuggestion,
        clearSuggestions,
    } = useAddressAutocomplete(addressLookupQuery, selectedAddressQuery);

    useEffect(() => {
        if (accountLoading || profileLoading || hasPrefilledRef.current) return;
        if (!account && !userProfile && !user) return;

        const metadata = asRecord(account?.metadata);
        const snapshot = asRecord(account?.onboarding_payload);
        const onboardingProfile = asRecord(snapshot.profile);
        const businessProfile = asRecord(snapshot.business_profile);
        const bankAccount = asRecord(snapshot.bank_account);
        const destinations = metadata.destinations || {};
        const pixDestination = snapshot.pix_destination || destinations.pix || {};
        const authMetadata = asRecord(user?.user_metadata);
        const profileAddress = asRecord(userProfile?.professional_address);
        const splitName = splitFullName(
            firstString(
                account?.holder_name,
                snapshot.name,
                userProfile?.full_name,
                userProfile?.name,
                authMetadata.full_name,
                authMetadata.name,
            ),
        );
        const hasBankSnapshot = Boolean(
            account?.bank_code ||
            account?.bank_account ||
            bankAccount.bank_code ||
            bankAccount.account_number
        );
        const hasPixSnapshot = Boolean(pixDestination.key || pixDestination.normalized_key);
        const accountNumber = [
            account?.bank_account || bankAccount.account_number || "",
            account?.bank_account_digit || bankAccount.account_digit || "",
        ].join("");

        setFormData((prev) => ({
            ...prev,
            ...(() => {
                const documentValue = firstString(account?.cpf_cnpj, snapshot.cpfCnpj, prev.cpf);
                const nextTaxpayerType: TaxpayerType = onlyDigits(documentValue).length > 11 ? "pj" : prev.taxpayerType;
                return {
                    taxpayerType: nextTaxpayerType,
                    cpf: maskCpfCnpj(documentValue, nextTaxpayerType),
                };
            })(),
            firstName: firstString(account?.holder_name?.split(" ")[0], onboardingProfile.first_name, userProfile?.first_name, authMetadata.first_name, splitName.firstName, prev.firstName),
            lastName: firstString(account?.holder_name?.split(" ").slice(1).join(" "), onboardingProfile.last_name, userProfile?.last_name, authMetadata.last_name, splitName.lastName, prev.lastName),
            birthDate: firstString(account?.birth_date, snapshot.birthDate, prev.birthDate),
            phone: maskPhone(firstString(account?.mobile_phone, snapshot.mobilePhone, userProfile?.phone, authMetadata.phone, prev.phone)),
            pep: firstString(account?.pep_status, onboardingProfile.political_exposure, prev.pep) as PepValue,
            cep: maskCep(firstString(account?.address_postal_code, snapshot.postalCode, profileAddress.postalCode, profileAddress.postal_code, prev.cep)),
            street: firstString(account?.address_street, snapshot.address, profileAddress.street, userProfile?.address, prev.street),
            number: firstString(account?.address_number, snapshot.addressNumber, profileAddress.number, prev.number),
            complement: firstString(account?.address_complement, snapshot.complement, profileAddress.complement, prev.complement),
            neighborhood: firstString(account?.address_neighborhood, snapshot.province, profileAddress.neighborhood, prev.neighborhood),
            city: firstString(account?.address_city, onboardingProfile.city, profileAddress.city, prev.city),
            state: firstString(account?.address_state, onboardingProfile.state, profileAddress.state, prev.state).toUpperCase().slice(0, 2),
            companyType: firstString(account?.company_type, snapshot.companyType, prev.companyType),
            incomeValue: account?.income_value ? String(account.income_value) : (snapshot.incomeValue ? String(snapshot.incomeValue) : prev.incomeValue),
            businessUrl: firstString(account?.business_url, snapshot.site, prev.businessUrl),
            businessDescription: firstString(account?.business_description, businessProfile.product_description, userProfile?.bio, prev.businessDescription),
            bankCode: maskBankCode(firstString(account?.bank_code, bankAccount.bank_code, prev.bankCode)),
            agency: maskAgency(firstString(account?.bank_agency, bankAccount.agency, prev.agency)),
            accountNumber: maskAccountNumber(accountNumber || prev.accountNumber),
            payoutMethod: hasBankSnapshot && hasPixSnapshot ? "both" : hasBankSnapshot ? "bank" : "pix",
            pixKeyType: coercePixKeyType(pixDestination.type || prev.pixKeyType),
            pixKey: pixDestination.key || pixDestination.normalized_key || prev.pixKey,
            tosAccepted: Boolean(account?.tos_accepted_at || snapshot.tos?.accepted || prev.tosAccepted),
        }));

        setUploadedDocIds({
            front: account?.document_front_id || snapshot.documents?.front_file_id || metadata.document_front_id || undefined,
            back: account?.document_back_id || snapshot.documents?.back_file_id || metadata.document_back_id || undefined,
        });
        hasPrefilledRef.current = true;
    }, [account, accountLoading, profileLoading, user, userProfile]);

    const steps: Step[] = useMemo(
        () => ["personal", "business", "banking", "verification", "review"],
        []
    );

    const currentIndex = steps.indexOf(step);

    const setField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
        let nextValue = value;

        if (field === "taxpayerType") {
            const nextTaxpayerType = value as TaxpayerType;
            setFormData((prev) => ({
                ...prev,
                taxpayerType: nextTaxpayerType,
                cpf: maskCpfCnpj(prev.cpf, nextTaxpayerType),
                companyType:
                    nextTaxpayerType === "pf" && !prev.companyType
                        ? "INDIVIDUAL"
                        : prev.companyType,
            }));
            return;
        }
        if (field === "cpf") nextValue = maskCpfCnpj(String(value), formData.taxpayerType) as FormData[K];
        if (field === "phone") nextValue = maskPhone(String(value)) as FormData[K];
        if (field === "cep") nextValue = maskCep(String(value)) as FormData[K];
        if (field === "state")
            nextValue = String(value).toUpperCase().slice(0, 2) as FormData[K];
        if (field === "bankCode")
            nextValue = maskBankCode(String(value)) as FormData[K];
        if (field === "agency")
            nextValue = maskAgency(String(value)) as FormData[K];
        if (field === "accountNumber")
            nextValue = maskAccountNumber(String(value)) as FormData[K];
        if (field === "pixKey")
            nextValue = formatPixKeyInput(String(value), formData.pixKeyType) as FormData[K];

        if (field === "cep" || field === "street") {
            setSelectedAddressQuery("");
            if (field === "cep") setAutoAppliedCep("");
        }

        setFormData((prev) => ({ ...prev, [field]: nextValue }));
    };

    const handleAddressSelect = useCallback(async (suggestion: AddressSuggestion) => {
        try {
            const validatedAddress = await validateSuggestion(suggestion);
            setFormData((prev) => applyValidatedAddressToForm(prev, validatedAddress));
            setSelectedAddressQuery(onlyDigits(validatedAddress.postalCode || "") || validatedAddress.label);
            setAutoAppliedCep(onlyDigits(validatedAddress.postalCode || ""));
            clearSuggestions();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não conseguimos validar este endereço.");
        }
    }, [clearSuggestions, validateSuggestion]);

    useEffect(() => {
        const cepDigits = onlyDigits(formData.cep);
        if (cepDigits.length !== 8 || autoAppliedCep === cepDigits || addressValidating) return;
        const viaCepSuggestion =
            addressSuggestions.find((suggestion) => suggestion.source === "viacep") ||
            (addressSuggestions.length === 1 ? addressSuggestions[0] : null);
        if (!viaCepSuggestion) return;

        setAutoAppliedCep(cepDigits);
        void handleAddressSelect(viaCepSuggestion);
    }, [addressSuggestions, addressValidating, autoAppliedCep, formData.cep, handleAddressSelect]);

    function setPixKeyType(value: PixKeyInputType) {
        setFormData((prev) => ({
            ...prev,
            pixKeyType: value,
            pixKey: formatPixKeyInput(prev.pixKey, value),
        }));
    }


    async function uploadDocumentsIfNeeded() {
        const result: UploadedDocIds = { ...uploadedDocIds };

        if (files.front && !result.front) {
            const formData = new FormData();
            formData.append("file", files.front);
            formData.append("document_type", "IDENTIFICATION");
            const response = await uploadFile.mutateAsync(formData);
            result.front = (response as any)?.document?.id;
        }

        if (files.back && !result.back) {
            const formData = new FormData();
            formData.append("file", files.back);
            formData.append("document_type", "IDENTIFICATION");
            const response = await uploadFile.mutateAsync(formData);
            result.back = (response as any)?.document?.id;
        }

        setUploadedDocIds(result);
        return result;
    }

    // ... validation methods omitted for brevity, keeping them as is ...
    function validatePersonalStep() {
        if (!formData.firstName.trim()) return "Informe seu nome.";
        if (!formData.lastName.trim()) return "Informe seu sobrenome.";
        if (formData.taxpayerType === "pf" && !validateCpf(formData.cpf)) return "Informe um CPF válido.";
        if (formData.taxpayerType === "pj" && !validateCnpj(formData.cpf)) return "Informe um CNPJ válido.";
        if (!validateBirthDate(formData.birthDate))
            return "Informe uma data de nascimento válida.";
        if (onlyDigits(formData.phone).length < 10)
            return "Informe um telefone válido.";
        if (!onlyDigits(formData.cep)) return "Informe o CEP.";
        if (!formData.street.trim()) return "Informe a rua.";
        if (!formData.number.trim()) return "Informe o número.";
        if (!formData.city.trim()) return "Informe a cidade.";
        if (formData.state.trim().length !== 2) return "Informe a UF com 2 letras.";
        return null;
    }

    function validateBusinessStep() {
        if (!formData.companyType) {
            return "Selecione o tipo de empresa.";
        }
        if (parseIncomeValue(formData.incomeValue) <= 0) {
            return "Informe o faturamento mensal.";
        }
        if (!formData.businessDescription.trim()) {
            return "Informe a descrição dos serviços.";
        }
        return null;
    }

    function validateBankAccountFields() {
        if (onlyDigits(formData.bankCode).length !== 3) {
            return "Informe um código bancário com 3 dígitos.";
        }
        if (!onlyDigits(formData.agency)) {
            return "Informe a agência.";
        }
        if (onlyDigits(formData.accountNumber).length < 4) {
            return "Informe uma conta bancária válida.";
        }
        return null;
    }

    function validateBankingStep() {
        const needsPix = formData.payoutMethod === "pix" || formData.payoutMethod === "both";
        const needsBank = formData.payoutMethod === "bank" || formData.payoutMethod === "both";

        if (needsPix && !normalizePixKeyInput(formData.pixKey, formData.pixKeyType)) {
            return "Informe uma chave Pix válida para receber repasses.";
        }

        if (needsBank) {
            return validateBankAccountFields();
        }

        return null;
    }

    function validateVerificationStep() {
        if (!files.front && !uploadedDocIds.front) {
            return "Envie ao menos a frente do documento.";
        }
        return null;
    }

    async function handleNext() {
        if (step === "personal") {
            const error = validatePersonalStep();
            if (error) return toast.error(error);
            return setStep("business");
        }

        if (step === "business") {
            const error = validateBusinessStep();
            if (error) return toast.error(error);
            return setStep("banking");
        }

        if (step === "banking") {
            const error = validateBankingStep();
            if (error) return toast.error(error);
            return setStep("verification");
        }

        if (step === "verification") {
            const error = validateVerificationStep();
            if (error) return toast.error(error);
            return setStep("review");
        }

        if (step === "review") {
            if (!formData.tosAccepted) {
                return toast.error("Você precisa aceitar os termos para continuar.");
            }
            await handleSubmit();
        }
    }

    function handleBack() {
        if (step === "personal") {
            onCancel?.();
            return;
        }
        if (step === "business") return setStep("personal");
        if (step === "banking") return setStep("business");
        if (step === "verification") return setStep("banking");
        if (step === "review") return setStep("verification");
    }

    async function pollAccountStatus(maxRetries = 12) {
        setIsPolling(true);
        let retries = 0;

        while (retries < maxRetries) {
            try {
                const result = await syncAccount.mutateAsync();
                const status = result?.status || result?.ui_status;

                // If status is no longer 'not_started' or 'account_missing', it means Asaas created it
                if (status && status !== "not_started" && status !== "account_missing") {
                    return true;
                }
            } catch (err) {
                console.warn("[Onboarding] Poll attempt failed:", err);
            }

            retries++;
            // Wait 2.5 seconds between polls (total ~30s max)
            await new Promise((resolve) => setTimeout(resolve, 2500));
        }
        return false;
    }

    async function handleSubmit() {
        setIsSubmitting(true);

        try {
            const currentAccountId = account?.asaas_account_id;

            if (!currentAccountId) {
                // Create subconta via asaas-connect-onboarding first
                const payload = buildOnboardingPayload(formData, uploadedDocIds);
                const onboardingResult = await startOnboarding.mutateAsync(payload as any);
                const newAccountId = (onboardingResult as any)?.asaas_account_id;
                
                if (!newAccountId) {
                    throw new Error("Não foi possível criar a conta NeuroFinance.");
                }
                
                // Immediately attempt to upload documents if provided
                toast.info("Conta criada! Sincronizando dados...");
                
                const docs = await uploadDocumentsIfNeeded();
                await updateAccount.mutateAsync(buildOnboardingPayload(formData, docs));

                // Poll for status update (Asaas sync window)
                const synced = await pollAccountStatus();
                if (!synced) {
                    toast.warning("A conta foi criada, mas a validação completa pode levar alguns minutos.");
                }
            } else {
                // Account already exists - update it and upload docs
                const docs = await uploadDocumentsIfNeeded();
                const payload = buildOnboardingPayload(formData, docs);
                await updateAccount.mutateAsync(payload);
                
                // Light sync
                await syncAccount.mutateAsync();
            }

            setStep("success");
        } catch (error: any) {
            console.error("[CustomOnboardingFlow] submit error", error);
            toast.error(getUserFacingErrorMessage(error, "save"));
        } finally {
            setIsSubmitting(false);
            setIsPolling(false);
        }
    }

    const renderContent = () => {
        if (step === "success") {
            return (
                <div className="flex flex-col items-center justify-center gap-6 py-20 text-center h-full">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-12 w-12" />
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-3xl font-black tracking-tight text-zinc-950 dark:text-white">
                            Conta em análise
                        </h3>
                        <p className="mx-auto max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                            Recebemos seus dados e enviamos tudo para validação. Assim que a conta
                            estiver pronta para receber e sacar, você verá o status atualizado no
                            NeuroFinance.
                        </p>
                    </div>

                    <Button
                        onClick={onComplete}
                        className="h-14 mt-4 rounded-2xl bg-zinc-950 px-8 font-black uppercase tracking-[0.18em] text-white shadow-xl dark:bg-white dark:text-zinc-950"
                    >
                        Ir para o dashboard
                    </Button>
                </div>
            );
        }

        return (
            <>
                <div className="flex min-h-0 flex-col h-full overflow-hidden">
                <div className="shrink-0 mb-5">
                    <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-zinc-950 dark:text-white">
                                NeuroFinance
                            </h1>
                            <p className="mt-2 whitespace-nowrap text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                                Cobranças, repasses e financeiro funcionando no automático.
                            </p>
                        </div>

                        {(isSubmitting || accountLoading || isPolling) && (
                            <div className="flex w-fit items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1.5 text-xs text-zinc-600 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                {isPolling ? "Validando seus dados..." : "Processando"}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {steps.map((s, i) => (
                            <div
                                key={s}
                                className={cn(
                                    "h-1.5 flex-1 rounded-full transition-all duration-500",
                                    i <= currentIndex
                                        ? "bg-zinc-950 dark:bg-white"
                                        : "bg-zinc-200 dark:bg-white/10"
                                )}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-1 -mx-1 pb-8 scrollbar-hide overscroll-contain">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.22 }}
                        >
                        {step === "personal" && (
                        <GlassCard
                            title="Dados pessoais"
                            subtitle="Identificação civil e endereço residencial."
                            icon={<User className="h-5 w-5" />}
                        >
                            <div className="space-y-6">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <SectionLabel>Nome</SectionLabel>
                                        <Input
                                            value={formData.firstName}
                                            onChange={(e) => setField("firstName", e.target.value)}
                                            placeholder="Seu nome"
                                            className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <SectionLabel>Sobrenome</SectionLabel>
                                        <Input
                                            value={formData.lastName}
                                            onChange={(e) => setField("lastName", e.target.value)}
                                            placeholder="Seu sobrenome"
                                            className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div className="space-y-2">
                                        <SectionLabel>Atuo como</SectionLabel>
                                        <Select
                                            value={formData.taxpayerType}
                                            onValueChange={(value) => setField("taxpayerType", value as TaxpayerType)}
                                        >
                                            <SelectTrigger className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]">
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="pf">Atuo como PF (Pessoa física)</SelectItem>
                                                <SelectItem value="pj">Atuo como PJ (Pessoa jurídica)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <SectionLabel>{formData.taxpayerType === "pj" ? "CNPJ" : "CPF"}</SectionLabel>
                                        <Input
                                            value={formData.cpf}
                                            onChange={(e) => setField("cpf", e.target.value)}
                                            inputMode="numeric"
                                            placeholder={formData.taxpayerType === "pj" ? "00.000.000/0000-00" : "000.000.000-00"}
                                            className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <SectionLabel>Telefone</SectionLabel>
                                        <Input
                                            value={formData.phone}
                                            onChange={(e) => setField("phone", e.target.value)}
                                            placeholder="(00) 00000-0000"
                                            className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <SectionLabel>Data de nascimento</SectionLabel>
                                        <Input
                                            type="date"
                                            value={formData.birthDate}
                                            onChange={(e) => setField("birthDate", e.target.value)}
                                            className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <SectionLabel>Exposição política (PEP)</SectionLabel>
                                        <Select
                                            value={formData.pep}
                                            onValueChange={(v: PepValue) => setField("pep", v)}
                                        >
                                            <SelectTrigger className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]">
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Não sou PEP</SelectItem>
                                                <SelectItem value="existing">Sou PEP</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-4 rounded-[24px] border border-black/10 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.02]">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-zinc-500" />
                                        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                                            Endereço residencial
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-1 space-y-2">
                                            <SectionLabel>CEP</SectionLabel>
                                            <Input
                                                value={formData.cep}
                                                onChange={(e) => setField("cep", e.target.value)}
                                                placeholder="00000-000"
                                                className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-2">
                                            <SectionLabel>Rua</SectionLabel>
                                            <Input
                                                value={formData.street}
                                                onChange={(e) => setField("street", e.target.value)}
                                                placeholder="Logradouro"
                                                className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                            />
                                        </div>
                                    </div>

                                    <AddressSuggestionList
                                        suggestions={addressSuggestions}
                                        loading={addressLoading || addressValidating}
                                        error={addressError}
                                        onSelect={(suggestion) => void handleAddressSelect(suggestion)}
                                    />

                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <div className="space-y-2">
                                            <SectionLabel>Número</SectionLabel>
                                            <Input
                                                value={formData.number}
                                                onChange={(e) => setField("number", e.target.value)}
                                                placeholder="123"
                                                className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <SectionLabel>Complemento</SectionLabel>
                                            <Input
                                                value={formData.complement}
                                                onChange={(e) => setField("complement", e.target.value)}
                                                placeholder="Apto, sala, etc."
                                                className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <SectionLabel>Bairro</SectionLabel>
                                            <Input
                                                value={formData.neighborhood}
                                                onChange={(e) => setField("neighborhood", e.target.value)}
                                                placeholder="Bairro"
                                                className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <SectionLabel>Cidade</SectionLabel>
                                            <Input
                                                value={formData.city}
                                                onChange={(e) => setField("city", e.target.value)}
                                                placeholder="Cidade"
                                                className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <SectionLabel>UF</SectionLabel>
                                            <Input
                                                value={formData.state}
                                                onChange={(e) => setField("state", e.target.value)}
                                                placeholder="SP"
                                                maxLength={2}
                                                className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    )}

                    {step === "business" && (
                        <GlassCard
                            title="Dados comerciais"
                            subtitle="Informações para cadastro da sua conta NeuroFinance."
                            icon={<Briefcase className="h-5 w-5" />}
                        >
                            <div className="space-y-5">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <SectionLabel>Tipo de empresa</SectionLabel>
                                        <Select
                                            value={formData.companyType}
                                            onValueChange={(v: string) => setField("companyType", v)}
                                        >
                                            <SelectTrigger className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]">
                                                <SelectValue placeholder="Selecione o tipo" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MEI">MEI</SelectItem>
                                                <SelectItem value="LIMITED">Limitada (LTDA)</SelectItem>
                                                <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                                                <SelectItem value="ASSOCIATION">Associação</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <SectionLabel>Faturamento mensal</SectionLabel>
                                        <Input
                                            value={formData.incomeValue}
                                            onChange={(e) => setField("incomeValue", e.target.value.replace(/[^\d.,]/g, ''))}
                                            placeholder="R$ 0,00"
                                            className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <SectionLabel>Site ou perfil profissional <span className="normal-case tracking-normal text-zinc-400">(Opcional)</span></SectionLabel>
                                    <Input
                                        value={formData.businessUrl}
                                        onChange={(e) => setField("businessUrl", e.target.value)}
                                        placeholder="https://seusite.com ou instagram.com/seuperfil"
                                        className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <SectionLabel>Descrição do serviço</SectionLabel>
                                    <Input
                                        value={formData.businessDescription}
                                        onChange={(e) =>
                                            setField("businessDescription", e.target.value)
                                        }
                                        placeholder="Ex.: Serviços de psicologia clínica"
                                        className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                    />
                                </div>

                                <div className="rounded-[24px] border border-emerald-500/15 bg-emerald-500/[0.04] p-4 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
                                    <div className="mb-2 flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                                            Categoria profissional
                                        </span>
                                    </div>
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                                        MCC 8099 configurado para serviços de saúde e profissionais da
                                        área clínica.
                                    </p>
                                </div>
                            </div>
                        </GlassCard>
                    )}

                    {step === "banking" && (
                        <GlassCard
                            title="Recebimento"
                            subtitle="Escolha como prefere receber os repasses das cobranças."
                            icon={<KeyRound className="h-5 w-5" />}
                        >
                            <div className="space-y-5">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {payoutMethodOptions.map((option) => {
                                        const Icon = option.icon;
                                        const active = formData.payoutMethod === option.id;

                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => setField("payoutMethod", option.id)}
                                                className={cn(
                                                    "rounded-[22px] border p-4 text-left transition-all duration-300 active:scale-[0.985]",
                                                    active
                                                        ? "border-zinc-950 bg-zinc-950 text-white shadow-[0_18px_40px_-24px_rgba(0,0,0,0.7)] dark:border-white dark:bg-white dark:text-zinc-950"
                                                        : "border-black/10 bg-white/60 text-zinc-950 hover:bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/[0.06]"
                                                )}
                                            >
                                                <Icon className="mb-4 h-5 w-5" />
                                                <p className="text-sm font-black">{option.title}</p>
                                                <p
                                                    className={cn(
                                                        "mt-1 text-xs leading-snug",
                                                        active ? "text-white/70 dark:text-zinc-700" : "text-zinc-500 dark:text-zinc-400"
                                                    )}
                                                >
                                                    {option.description}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>

                                {(formData.payoutMethod === "pix" || formData.payoutMethod === "both") && (
                                    <div className="rounded-[24px] border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.025]">
                                        <div className="mb-4 flex items-center gap-2">
                                            <KeyRound className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                                            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                                                Chave Pix para repasse
                                            </span>
                                        </div>
                                        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                                            <div className="space-y-2">
                                                <SectionLabel>Tipo da chave</SectionLabel>
                                                <Select
                                                    value={formData.pixKeyType}
                                                    onValueChange={(value: PixKeyInputType) => setPixKeyType(value)}
                                                >
                                                    <SelectTrigger className="h-12 rounded-2xl border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/[0.04]">
                                                        <SelectValue placeholder="Tipo" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {PIX_KEY_TYPES.map((type) => (
                                                            <SelectItem key={type.value} value={type.value}>
                                                                {type.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <SectionLabel>Chave Pix</SectionLabel>
                                                <Input
                                                    value={formData.pixKey}
                                                    onChange={(event) => setField("pixKey", event.target.value)}
                                                    placeholder={PIX_KEY_TYPES.find((type) => type.value === formData.pixKeyType)?.hint || "Digite a chave Pix"}
                                                    className="h-12 rounded-2xl border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/[0.04]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(formData.payoutMethod === "bank" || formData.payoutMethod === "both") && (
                                    <div className="space-y-5 rounded-[24px] border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.025]">
                                <div className="space-y-2">
                                    <SectionLabel>Código do banco</SectionLabel>
                                    <Input
                                        value={formData.bankCode}
                                        onChange={(e) => setField("bankCode", e.target.value)}
                                        inputMode="numeric"
                                        placeholder="001"
                                        className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                    />
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <SectionLabel>Agência</SectionLabel>
                                        <Input
                                            value={formData.agency}
                                            onChange={(e) => setField("agency", e.target.value)}
                                            inputMode="numeric"
                                            placeholder="0001-0"
                                            className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <SectionLabel>Conta + dígito</SectionLabel>
                                        <Input
                                            value={formData.accountNumber}
                                            onChange={(e) => setField("accountNumber", e.target.value)}
                                            inputMode="numeric"
                                            placeholder="123456-7"
                                            className="h-12 rounded-2xl border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]"
                                        />
                                    </div>
                                </div>

                                <div className="rounded-[24px] border border-amber-500/15 bg-amber-500/[0.05] p-4 dark:border-amber-500/20 dark:bg-amber-500/[0.08]">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-400" />
                                        <p className="text-sm text-amber-800 dark:text-amber-300">
                                            A conta bancária precisa ser da mesma titularidade do documento enviado
                                            no onboarding.
                                        </p>
                                    </div>
                                </div>
                                    </div>
                                )}

                                <PaymentFeesPreview items={paymentFeeCards} />
                            </div>
                        </GlassCard>
                    )}

                    {step === "verification" && (
                        <GlassCard
                            title="Verificação documental"
                            subtitle="Envie os arquivos para validação KYC."
                            icon={<ShieldCheck className="h-5 w-5" />}
                        >
                            <div className="mb-4 flex items-start gap-3 rounded-[22px] border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.025]">
                                <Camera className="mt-0.5 h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                                    No celular, você pode tirar a foto da frente e do verso. No desktop, envie imagem ou PDF.
                                </p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div
                                    onClick={() => fileInputFrontRef.current?.click()}
                                    className={cn(
                                        "group cursor-pointer rounded-[24px] border-2 border-dashed p-6 text-center transition-all",
                                        files.front || uploadedDocIds.front
                                            ? "border-emerald-500/50 bg-emerald-500/[0.05]"
                                            : "border-black/10 bg-black/[0.02] hover:bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                                    )}
                                >
                                    <input
                                        ref={fileInputFrontRef}
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="hidden"
                                        onChange={(e) =>
                                            setFiles((prev) => ({
                                                ...prev,
                                                front: e.target.files?.[0] || null,
                                            }))
                                        }
                                    />

                                    {files.front || uploadedDocIds.front ? (
                                        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
                                    ) : (
                                        <FileUp className="mx-auto mb-3 h-8 w-8 text-zinc-400" />
                                    )}

                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-900 dark:text-white">
                                        Frente do documento
                                    </p>
                                    <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                                        {files.front?.name || "RG, CNH ou documento equivalente"}
                                    </p>
                                </div>

                                <div
                                    onClick={() => fileInputBackRef.current?.click()}
                                    className={cn(
                                        "group cursor-pointer rounded-[24px] border-2 border-dashed p-6 text-center transition-all",
                                        files.back || uploadedDocIds.back
                                            ? "border-emerald-500/50 bg-emerald-500/[0.05]"
                                            : "border-black/10 bg-black/[0.02] hover:bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                                    )}
                                >
                                    <input
                                        ref={fileInputBackRef}
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="hidden"
                                        onChange={(e) =>
                                            setFiles((prev) => ({
                                                ...prev,
                                                back: e.target.files?.[0] || null,
                                            }))
                                        }
                                    />

                                    {files.back || uploadedDocIds.back ? (
                                        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
                                    ) : (
                                        <Upload className="mx-auto mb-3 h-8 w-8 text-zinc-400" />
                                    )}

                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-900 dark:text-white">
                                        Verso do documento
                                    </p>
                                    <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                                        {files.back?.name || "Opcional quando aplicável"}
                                    </p>
                                </div>
                            </div>
                        </GlassCard>
                    )}

                    {step === "review" && (
                        <GlassCard
                            title="Revisão final"
                            subtitle="Confira tudo antes de enviar para validação."
                            icon={<ShieldCheck className="h-5 w-5" />}
                        >
                            <div className="space-y-4">
                                <div className="relative rounded-[24px] border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.02]">
                                    <button
                                        onClick={() => setStep("personal")}
                                        className="absolute right-4 top-4 rounded-lg p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                                        Dados pessoais
                                    </p>
                                    <div className="grid gap-y-3 sm:grid-cols-2">
                                        <div>
                                            <p className="text-[10px] uppercase text-zinc-500">Nome</p>
                                            <p className="text-sm font-bold text-zinc-950 dark:text-white">
                                                {formData.firstName} {formData.lastName}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-zinc-500">
                                                {formData.taxpayerType === "pj" ? "CNPJ" : "CPF"}
                                            </p>
                                            <p className="text-sm font-bold text-zinc-950 dark:text-white">
                                                {formData.cpf}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-zinc-500">Nascimento</p>
                                            <p className="text-sm font-bold text-zinc-950 dark:text-white">
                                                {formData.birthDate.split("-").reverse().join("/")}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-zinc-500">Telefone</p>
                                            <p className="text-sm font-bold text-zinc-950 dark:text-white">
                                                {formData.phone}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative rounded-[24px] border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.02]">
                                    <button
                                        onClick={() => setStep("business")}
                                        className="absolute right-4 top-4 rounded-lg p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                                        Dados do negócio
                                    </p>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-[10px] uppercase text-zinc-500">Descrição</p>
                                            <p className="text-sm font-bold text-zinc-950 dark:text-white">
                                                {formData.businessDescription}
                                            </p>
                                        </div>
                                        {!!formData.businessUrl.trim() && (
                                            <div>
                                                <p className="text-[10px] uppercase text-zinc-500">Site / perfil</p>
                                                <p className="truncate text-sm font-bold text-zinc-950 dark:text-white">
                                                    {normalizeBusinessUrl(formData.businessUrl)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="relative rounded-[24px] border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.02]">
                                    <button
                                        onClick={() => setStep("banking")}
                                        className="absolute right-4 top-4 rounded-lg p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                                        Recebimento
                                    </p>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {(formData.payoutMethod === "pix" || formData.payoutMethod === "both") && (
                                            <div className="rounded-2xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                                <p className="text-[10px] uppercase text-zinc-500">Pix</p>
                                                <p className="mt-1 truncate text-sm font-bold text-zinc-950 dark:text-white">
                                                    {PIX_KEY_TYPES.find((type) => type.value === formData.pixKeyType)?.label}: {formData.pixKey}
                                                </p>
                                            </div>
                                        )}
                                        {(formData.payoutMethod === "bank" || formData.payoutMethod === "both") && (
                                            <div className="rounded-2xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                                <p className="text-[10px] uppercase text-zinc-500">Banco</p>
                                                <p className="mt-1 text-sm font-bold text-zinc-950 dark:text-white">
                                                    {formData.bankCode} · {formData.agency} / {formData.accountNumber}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="relative rounded-[24px] border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.02]">
                                    <button
                                        onClick={() => setStep("verification")}
                                        className="absolute right-4 top-4 rounded-lg p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                                        Documentos
                                    </p>
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                            <span className="text-[11px] font-bold uppercase tracking-[0.18em]">
                                                Frente
                                            </span>
                                        </div>
                                        {(files.back || uploadedDocIds.back) && (
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                <span className="text-[11px] font-bold uppercase tracking-[0.18em]">
                                                    Verso
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-[24px] border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.02]">
                                    <div className="flex items-start gap-3">
                                        <input
                                            id="tos"
                                            type="checkbox"
                                            checked={formData.tosAccepted}
                                            onChange={(e) => setField("tosAccepted", e.target.checked)}
                                            className="mt-1"
                                        />
                                        <Label
                                            htmlFor="tos"
                                            className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300"
                                        >
                                            Concordo com os{" "}
                                            <button
                                                type="button"
                                                onClick={() => setIsTermsModalOpen(true)}
                                                className="font-bold underline"
                                            >
                                                Termos de Serviço
                                            </button>{" "}
                                            e autorizo o envio dos meus dados para validação KYC e
                                            ativação da conta conectada.
                                        </Label>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    )}
                </motion.div>
            </AnimatePresence>
            </div>

            <div className="shrink-0 mt-3 flex flex-col gap-4 border-t border-black/10 bg-[#f8f8f6]/92 pt-4 backdrop-blur-2xl dark:border-white/10 dark:bg-[#020202]/92">
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={handleBack}
                        disabled={isSubmitting}
                        className="h-12 flex-1 rounded-[16px] border-black/10 bg-white/50 text-[10px] font-black uppercase tracking-[0.16em] backdrop-blur-xl transition-all duration-300 hover:bg-black/5 active:scale-[0.985] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/5"
                    >
                        {step === "personal" ? (
                            "Cancelar"
                        ) : (
                            <>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar
                            </>
                        )}
                    </Button>

                    <Button
                        onClick={handleNext}
                        disabled={isSubmitting}
                        className="h-12 flex-[1.4] rounded-[16px] bg-zinc-950 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_-18px_rgba(0,0,0,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 active:translate-y-0 active:scale-[0.985] dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processando
                            </>
                        ) : (
                            <>
                                {step === "review" ? "Concluir onboarding" : "Próximo passo"}
                                {step !== "review" && <ArrowRight className="ml-2 h-4 w-4" />}
                            </>
                        )}
                    </Button>
                </div>
                </div>
            </div>

            <TermsOfUseModal
                isOpen={isTermsModalOpen}
                onOpenChange={setIsTermsModalOpen}
            />
            </>
        );
    };

    return (
        <div className={cn(
            "relative isolate w-full flex min-h-0 flex-col overflow-hidden bg-[#f8f8f6] dark:bg-[#020202] lg:flex-row",
            fullScreen 
                ? "h-full max-h-full"
                : "h-[min(88dvh,900px)] max-h-[900px] border border-black/5 shadow-[0_30px_120px_rgba(0,0,0,0.15)] dark:border-white/5 dark:shadow-[0_30px_120px_rgba(0,0,0,0.6)] sm:rounded-[40px]"
        )}>
            
            {/* Left Column - 3D Visual & Compliance */}
            <div className="relative hidden shrink-0 overflow-hidden border-r border-black/5 bg-[radial-gradient(circle_at_50%_22%,rgba(255,255,255,0.12),transparent_28%),linear-gradient(145deg,#050505_0%,#151515_50%,#030303_100%)] p-8 dark:border-white/5 lg:flex lg:w-[40%] xl:w-[42%] xl:p-10">
                <div className="absolute inset-0 opacity-60 backdrop-blur-3xl" />
                
                {/* Stamp at top-left inner */}
                <div className="absolute top-8 left-8 z-20">
                    <BrandComplianceStrip />
                </div>
                
                {/* 3D Model */}
                <div className="relative z-10 flex h-full w-full items-center justify-center transition-transform duration-700">
                    <NeuroFinanceCardVisual performanceMode />
                </div>
            </div>

            {/* Right Column - Formulation / Form */}
            <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#f8f8f6] dark:bg-[#020202]">
                <div className="flex h-full min-h-0 w-full flex-col overflow-hidden p-4 sm:p-5 lg:p-7 xl:p-8">
                   {renderContent()}
                </div>
            </div>
        </div>
    );
};
