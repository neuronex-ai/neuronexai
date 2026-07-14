import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Building2, Camera, CheckCircle2, FileUp, KeyRound, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AsaasStamp } from "@/components/financeiro/AsaasStamp";
import { useAddressAutocomplete, type AddressSuggestion, type ValidatedAddress } from "@/hooks/use-address-autocomplete";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { useNeuroFinanceTariffs } from "@/hooks/use-neurofinance-tariffs";
import { useProfile } from "@/hooks/use-profile";
import { formatPixKeyInput, normalizePixKeyInput, type PixKeyInputType } from "@/lib/financial-input";
import type { TariffRule } from "@/lib/neurofinance-types";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";
import { formatMoney, mobileFinanceSurface } from "../../shared/MobileFinancePrimitives";

type Step = "personal" | "business" | "bank" | "documents" | "review";
type PayoutMethod = "pix" | "bank" | "both";
type TaxpayerType = "pf" | "pj";

type FormState = {
  firstName: string;
  lastName: string;
  taxpayerType: TaxpayerType;
  cpf: string;
  birthDate: string;
  phone: string;
  pep: "none" | "existing";
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  companyType: string;
  incomeValue: string;
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

const steps: Array<{ id: Step; label: string }> = [
  { id: "personal", label: "Dados" },
  { id: "business", label: "Clínica" },
  { id: "bank", label: "Receber" },
  { id: "documents", label: "Docs" },
  { id: "review", label: "Revisão" },
];

const initialForm: FormState = {
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

const pixKeyTypes: Array<{ value: PixKeyInputType; label: string; hint: string }> = [
  { value: "cpf", label: "CPF", hint: "000.000.000-00" },
  { value: "cnpj", label: "CNPJ", hint: "00.000.000/0000-00" },
  { value: "email", label: "E-mail", hint: "seu@email.com" },
  { value: "telefone", label: "Telefone", hint: "+55 (00) 00000-0000" },
  { value: "evp", label: "Aleatória", hint: "Chave aleatória" },
];

const payoutOptions: Array<{ id: PayoutMethod; label: string; helper: string; icon: ElementType }> = [
  { id: "pix", label: "Chave Pix", helper: "Receba sem preencher banco agora.", icon: KeyRound },
  { id: "bank", label: "Conta", helper: "Agência e conta de mesma titularidade.", icon: Building2 },
  { id: "both", label: "Pix + conta", helper: "Deixe os dois destinos prontos.", icon: ShieldCheck },
];

const companyTypes = [
  { value: "MEI", label: "MEI" },
  { value: "LIMITED", label: "Limitada" },
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "ASSOCIATION", label: "Associação" },
];

const fallbackFees = [
  { key: "pix", title: "Pix", price: "Tabela vigente", settlement: "Instantâneo" },
  { key: "boleto", title: "Boleto", price: "Tabela vigente", settlement: "1 a 2 dias úteis" },
  { key: "credit", title: "Crédito", price: "Tabela vigente", settlement: "Conforme parcela" },
  { key: "debit", title: "Débito", price: "Tabela vigente", settlement: "Até 1 dia útil" },
];

function buildFeeCards(ruleSet: TariffRule[] = []) {
  const findByTerms = (...terms: string[]) =>
    ruleSet.find((rule) => {
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

  return [
    { ...fallbackFees[0], rule: findByTerms("pix") },
    { ...fallbackFees[1], rule: findByTerms("boleto") },
    { ...fallbackFees[2], rule: findByTerms("cart") || findByTerms("credit") || findByTerms("credito") },
    { ...fallbackFees[3], rule: findByTerms("deb") || findByTerms("debito") },
  ].map((item) => ({
    ...item,
    price: item.rule?.price_label || item.price,
    settlement: item.rule?.settlement_label || item.settlement,
  }));
}

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const maskCpf = (value: string) =>
  onlyDigits(value)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
    .slice(0, 14);
const maskCnpj = (value: string) =>
  onlyDigits(value)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
    .slice(0, 18);
const maskCpfCnpj = (value: string, taxpayerType: TaxpayerType) =>
  taxpayerType === "pj" ? maskCnpj(value) : maskCpf(value);
const maskPhone = (value: string) =>
  onlyDigits(value)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .slice(0, 15);
const maskCep = (value: string) => onlyDigits(value).replace(/(\d{5})(\d)/, "$1-$2").slice(0, 9);
const maskAgency = (value: string) => {
  const digits = onlyDigits(value).slice(0, 6);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};
const maskAccountNumber = (value: string) => {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 1) return digits;
  if (digits.length <= 8) return digits.replace(/(\d+)(\d)$/, "$1-$2");
  return `${digits.slice(0, -1)}-${digits.slice(-1)}`;
};
const parseIncome = (value: string) => Number(value.replace(/\./g, "").replace(",", ".")) || 0;
const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

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

function applyValidatedAddressToForm(current: FormState, address: ValidatedAddress): FormState {
  return {
    ...current,
    cep: maskCep(address.postalCode || current.cep),
    street: address.street || current.street,
    number: address.number || current.number,
    neighborhood: address.neighborhood || current.neighborhood,
    city: address.city || current.city,
    state: (address.state || current.state).toUpperCase().slice(0, 2),
  };
}

function buildPayload(form: FormState, docs: { front?: string; back?: string }) {
  const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();

  return {
    name: fullName,
    email: "",
    cpfCnpj: onlyDigits(form.cpf),
    birthDate: form.birthDate,
    mobilePhone: onlyDigits(form.phone),
    companyType: form.companyType || undefined,
    incomeValue: parseIncome(form.incomeValue) || undefined,
    address: form.street.trim(),
    addressNumber: form.number.trim(),
    complement: form.complement.trim() || undefined,
    province: form.neighborhood.trim(),
    postalCode: onlyDigits(form.cep),
    site: normalizeUrl(form.businessUrl) || undefined,
    profile: {
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      taxpayer_type: form.taxpayerType,
      political_exposure: form.pep,
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
    },
    business_profile: {
      mcc: "8099",
      product_description: form.businessDescription.trim(),
    },
    bank_account: {
      country: "BR",
      currency: "brl",
      account_holder_type: form.taxpayerType === "pj" ? "company" : "individual",
      account_holder_name: fullName,
      cpfCnpj: onlyDigits(form.cpf),
      bank_code: onlyDigits(form.bankCode),
      agency: onlyDigits(form.agency),
      account_number: onlyDigits(form.accountNumber),
      account_type: "CONTA_CORRENTE",
    },
    pix_destination: form.pixKey.trim()
      ? {
        type: form.pixKeyType,
        key: form.pixKey.trim(),
        normalized_key: normalizePixKeyInput(form.pixKey, form.pixKeyType),
      }
      : null,
    payout_destination: form.payoutMethod,
    documents: {
      front_file_id: docs.front || null,
      back_file_id: docs.back || null,
    },
    tos: {
      accepted: form.tosAccepted,
    },
  };
}

export function MobileNeuroFinanceOnboardingSheet({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}) {
  const account = useFinancialAccount();
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { data: tariffRules = [] } = useNeuroFinanceTariffs();
  const [step, setStep] = useState<Step>("personal");
  const [form, setForm] = useState<FormState>(initialForm);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedAddressQuery, setSelectedAddressQuery] = useState("");
  const [autoAppliedCep, setAutoAppliedCep] = useState("");
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const frontCameraRef = useRef<HTMLInputElement>(null);
  const backCameraRef = useRef<HTMLInputElement>(null);
  const hasPrefilledRef = useRef(false);

  const stepIndex = steps.findIndex((item) => item.id === step);
  const progress = useMemo(() => ((stepIndex + 1) / steps.length) * 100, [stepIndex]);
  const feeCards = useMemo(() => buildFeeCards(tariffRules), [tariffRules]);
  const addressLookupQuery = useMemo(() => {
    const cepDigits = onlyDigits(form.cep);
    if (cepDigits.length >= 8) return cepDigits;
    return form.street.trim();
  }, [form.cep, form.street]);
  const {
    suggestions: addressSuggestions,
    isLoading: addressLoading,
    isValidating: addressValidating,
    error: addressError,
    validateSuggestion,
    clearSuggestions,
  } = useAddressAutocomplete(addressLookupQuery, selectedAddressQuery);

  useEffect(() => {
    if (!open || hasPrefilledRef.current || account.isLoading || profileLoading) return;
    if (!account.account && !profile && !user) return;

    const record = account.account;
    const metadata = asRecord(record?.metadata);
    const snapshot = asRecord(record?.onboarding_payload);
    const onboardingProfile = asRecord(snapshot.profile);
    const businessProfile = asRecord(snapshot.business_profile);
    const bankAccount = asRecord(snapshot.bank_account);
    const destinations = asRecord(metadata.destinations);
    const pixDestination = asRecord(snapshot.pix_destination || destinations.pix);
    const authMetadata = asRecord(user?.user_metadata);
    const profileAddress = asRecord(profile?.professional_address);
    const splitName = splitFullName(
      firstString(
        record?.holder_name,
        snapshot.name,
        profile?.full_name,
        profile?.name,
        authMetadata.full_name,
        authMetadata.name,
      ),
    );
    const hasBankSnapshot = Boolean(record?.bank_code || record?.bank_account || bankAccount.bank_code || bankAccount.account_number);
    const hasPixSnapshot = Boolean(pixDestination.key || pixDestination.normalized_key);
    const accountNumber = [
      record?.bank_account || bankAccount.account_number || "",
      record?.bank_account_digit || bankAccount.account_digit || "",
    ].join("");

    setForm((current) => ({
      ...current,
      ...(() => {
        const documentValue = firstString(record?.cpf_cnpj, snapshot.cpfCnpj, current.cpf);
        const taxpayerType: TaxpayerType = onlyDigits(documentValue).length > 11 ? "pj" : current.taxpayerType;
        return {
          taxpayerType,
          cpf: maskCpfCnpj(documentValue, taxpayerType),
        };
      })(),
      firstName: firstString(record?.holder_name?.split(" ")[0], onboardingProfile.first_name, profile?.first_name, authMetadata.first_name, splitName.firstName, current.firstName),
      lastName: firstString(record?.holder_name?.split(" ").slice(1).join(" "), onboardingProfile.last_name, profile?.last_name, authMetadata.last_name, splitName.lastName, current.lastName),
      birthDate: firstString(record?.birth_date, snapshot.birthDate, current.birthDate),
      phone: maskPhone(firstString(record?.mobile_phone, snapshot.mobilePhone, profile?.phone, authMetadata.phone, current.phone)),
      pep: firstString(record?.pep_status, onboardingProfile.political_exposure, current.pep) as FormState["pep"],
      cep: maskCep(firstString(record?.address_postal_code, snapshot.postalCode, profileAddress.postalCode, profileAddress.postal_code, current.cep)),
      street: firstString(record?.address_street, snapshot.address, profileAddress.street, profile?.address, current.street),
      number: firstString(record?.address_number, snapshot.addressNumber, profileAddress.number, current.number),
      complement: firstString(record?.address_complement, snapshot.complement, profileAddress.complement, current.complement),
      neighborhood: firstString(record?.address_neighborhood, snapshot.province, profileAddress.neighborhood, current.neighborhood),
      city: firstString(record?.address_city, onboardingProfile.city, profileAddress.city, current.city),
      state: firstString(record?.address_state, onboardingProfile.state, profileAddress.state, current.state).toUpperCase().slice(0, 2),
      companyType: firstString(record?.company_type, snapshot.companyType, current.companyType),
      incomeValue: record?.income_value ? String(record.income_value) : (snapshot.incomeValue ? String(snapshot.incomeValue) : current.incomeValue),
      businessUrl: firstString(record?.business_url, snapshot.site, current.businessUrl),
      businessDescription: firstString(record?.business_description, businessProfile.product_description, profile?.bio, current.businessDescription),
      bankCode: onlyDigits(firstString(record?.bank_code, bankAccount.bank_code, current.bankCode)).slice(0, 3),
      agency: maskAgency(firstString(record?.bank_agency, bankAccount.agency, current.agency)),
      accountNumber: maskAccountNumber(accountNumber || current.accountNumber),
      payoutMethod: hasBankSnapshot && hasPixSnapshot ? "both" : hasBankSnapshot ? "bank" : "pix",
      pixKeyType: (["cpf", "cnpj", "email", "telefone", "evp"].includes(String(pixDestination.type || "").toLowerCase())
        ? String(pixDestination.type).toLowerCase()
        : current.pixKeyType) as PixKeyInputType,
      pixKey: firstString(pixDestination.key, pixDestination.normalized_key, current.pixKey),
      tosAccepted: Boolean(record?.tos_accepted_at || snapshot.tos?.accepted || current.tosAccepted),
    }));

    hasPrefilledRef.current = true;
  }, [account.account, account.isLoading, open, profile, profileLoading, user]);

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    let nextValue = value;
    if (field === "taxpayerType") {
      const taxpayerType = value as TaxpayerType;
      setForm((current) => ({
        ...current,
        taxpayerType,
        cpf: maskCpfCnpj(current.cpf, taxpayerType),
        companyType: taxpayerType === "pf" && !current.companyType ? "INDIVIDUAL" : current.companyType,
      }));
      return;
    }
    if (field === "cpf") nextValue = maskCpfCnpj(String(value), form.taxpayerType) as FormState[K];
    if (field === "phone") nextValue = maskPhone(String(value)) as FormState[K];
    if (field === "cep") nextValue = maskCep(String(value)) as FormState[K];
    if (field === "state") nextValue = String(value).toUpperCase().slice(0, 2) as FormState[K];
    if (field === "bankCode") nextValue = onlyDigits(String(value)).slice(0, 3) as FormState[K];
    if (field === "agency") nextValue = maskAgency(String(value)) as FormState[K];
    if (field === "accountNumber") nextValue = maskAccountNumber(String(value)) as FormState[K];
    if (field === "pixKey") nextValue = formatPixKeyInput(String(value), form.pixKeyType) as FormState[K];
    if (field === "cep" || field === "street") {
      setSelectedAddressQuery("");
      if (field === "cep") setAutoAppliedCep("");
    }
    setForm((current) => ({ ...current, [field]: nextValue }));
  };

  const selectAddress = useCallback(async (suggestion: AddressSuggestion) => {
    try {
      const validatedAddress = await validateSuggestion(suggestion);
      setForm((current) => applyValidatedAddressToForm(current, validatedAddress));
      setSelectedAddressQuery(onlyDigits(validatedAddress.postalCode || "") || validatedAddress.label);
      setAutoAppliedCep(onlyDigits(validatedAddress.postalCode || ""));
      clearSuggestions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não conseguimos validar este endereço.");
    }
  }, [clearSuggestions, validateSuggestion]);

  useEffect(() => {
    const cepDigits = onlyDigits(form.cep);
    if (cepDigits.length !== 8 || autoAppliedCep === cepDigits || addressValidating) return;
    const viaCepSuggestion =
      addressSuggestions.find((suggestion) => suggestion.source === "viacep") ||
      (addressSuggestions.length === 1 ? addressSuggestions[0] : null);
    if (!viaCepSuggestion) return;

    setAutoAppliedCep(cepDigits);
    void selectAddress(viaCepSuggestion);
  }, [addressSuggestions, addressValidating, autoAppliedCep, form.cep, selectAddress]);

  const setPixKeyType = (value: PixKeyInputType) => {
    setForm((current) => ({
      ...current,
      pixKeyType: value,
      pixKey: formatPixKeyInput(current.pixKey, value),
    }));
  };

  const currentError = () => {
    if (step === "personal") {
      if (!form.firstName.trim() || !form.lastName.trim()) return "Informe nome e sobrenome.";
      if (form.taxpayerType === "pf" && onlyDigits(form.cpf).length !== 11) return "Informe um CPF válido.";
      if (form.taxpayerType === "pj" && onlyDigits(form.cpf).length !== 14) return "Informe um CNPJ válido.";
      if (!form.birthDate || !form.phone.trim()) return "Complete nascimento e telefone.";
    }
    if (step === "business") {
      if (!form.cep || !form.street || !form.number || !form.neighborhood || !form.city || form.state.length !== 2) return "Complete o endereço.";
      if (!form.companyType || parseIncome(form.incomeValue) <= 0) return "Informe tipo de empresa e faturamento.";
      if (form.businessDescription.trim().length < 20) return "Descreva sua atividade clínica.";
    }
    if (step === "bank") {
      const needsPix = form.payoutMethod === "pix" || form.payoutMethod === "both";
      const needsBank = form.payoutMethod === "bank" || form.payoutMethod === "both";
      if (needsPix && !normalizePixKeyInput(form.pixKey, form.pixKeyType)) return "Informe uma chave Pix válida.";
      if (needsBank && (onlyDigits(form.bankCode).length !== 3 || !form.agency || !form.accountNumber)) return "Complete os dados bancários.";
    }
    if (step === "documents" && !frontFile && !account.account?.document_front_id) return "Envie ao menos a frente do documento.";
    if (step === "review" && !form.tosAccepted) return "Aceite os termos para enviar.";
    return null;
  };

  const uploadDocument = async (file: File | null) => {
    if (!file) return null;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", "IDENTIFICATION");
    const result = await account.uploadFile.mutateAsync(formData);
    return String((result as any)?.document?.id || (result as any)?.id || "");
  };

  const submit = async () => {
    const validation = currentError();
    if (validation) {
      toast.error(validation);
      return;
    }

    setSaving(true);
    try {
      const currentAccountId = account.account?.asaas_account_id;
      const currentDocs = {
        front: account.account?.document_front_id || undefined,
        back: account.account?.document_back_id || undefined,
      };

      if (currentAccountId) {
        const front = await uploadDocument(frontFile);
        const back = await uploadDocument(backFile);
        await account.updateAccount.mutateAsync(buildPayload(form, {
          front: front || currentDocs.front,
          back: back || currentDocs.back,
        }));
      } else {
        const onboardingResult = await account.startOnboarding.mutateAsync(buildPayload(form, currentDocs));
        if (!(onboardingResult as any)?.asaas_account_id) {
          throw new Error("Não foi possível criar a conta conectada.");
        }

        const front = await uploadDocument(frontFile);
        const back = await uploadDocument(backFile);
        await account.updateAccount.mutateAsync(buildPayload(form, {
          front: front || currentDocs.front,
          back: back || currentDocs.back,
        }));
      }

      await account.syncAccount.mutateAsync();

      toast.success("Conta NeuroFinance enviada para análise.");
      await account.refetch();
      onComplete();
      onOpenChange(false);
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "save"));
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    const validation = currentError();
    if (validation) {
      toast.error(validation);
      return;
    }
    if (step === "review") void submit();
    else setStep(steps[Math.min(stepIndex + 1, steps.length - 1)].id);
  };

  const back = () => {
    if (step === "personal") onOpenChange(false);
    else setStep(steps[Math.max(stepIndex - 1, 0)].id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="z-[130] h-[min(94dvh,52rem)] overflow-hidden rounded-t-[32px] border-x-0 border-b-0 border-t border-border/50 bg-[#f8f8f6] p-0 text-zinc-950 shadow-[0_-24px_80px_-48px_rgba(0,0,0,0.5)] dark:border-white/10 dark:bg-[#020202] dark:text-white">
        <div className="flex h-full flex-col">
          <header className="shrink-0 px-5 pb-4 pt-5">
            <div className="mx-auto mb-4 h-1 w-11 rounded-full bg-foreground/14" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.22em] text-muted-foreground">NeuroFinance</p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.055em]">Criar conta</h2>
                <p className="mt-1 max-w-[15rem] text-xs font-semibold leading-snug text-muted-foreground">
                  Cobranças, repasses e documentos em um fluxo seguro.
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-foreground text-background">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <MobileBrandSeal className="mt-4" />
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-foreground/8">
              <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 flex justify-between">
              {steps.map((item) => (
                <span key={item.id} className={cn("text-[7px] font-black uppercase tracking-[0.08em]", item.id === step ? "text-foreground" : "text-muted-foreground/45")}>{item.label}</span>
              ))}
            </div>
          </header>

          <div className="mobile-scroll-owner min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            <div className={cn(mobileFinanceSurface, "space-y-4 p-4 shadow-[0_18px_54px_-42px_rgba(0,0,0,0.55)]")}>
              {step === "personal" ? (
                <>
                  <Field label="Nome"><Input value={form.firstName} onChange={(event) => setField("firstName", event.target.value)} className="h-12 rounded-[16px]" /></Field>
                  <Field label="Sobrenome"><Input value={form.lastName} onChange={(event) => setField("lastName", event.target.value)} className="h-12 rounded-[16px]" /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setField("taxpayerType", "pf")}
                      className={cn(
                        "min-h-11 rounded-[15px] border px-3 text-[9px] font-black uppercase tracking-[0.08em] transition active:scale-[0.985]",
                        form.taxpayerType === "pf"
                          ? "border-foreground bg-foreground text-background"
                          : "border-border/55 bg-background/70 text-foreground dark:border-white/10",
                      )}
                    >
                      Atuo como PF
                    </button>
                    <button
                      type="button"
                      onClick={() => setField("taxpayerType", "pj")}
                      className={cn(
                        "min-h-11 rounded-[15px] border px-3 text-[9px] font-black uppercase tracking-[0.08em] transition active:scale-[0.985]",
                        form.taxpayerType === "pj"
                          ? "border-foreground bg-foreground text-background"
                          : "border-border/55 bg-background/70 text-foreground dark:border-white/10",
                      )}
                    >
                      Atuo como PJ
                    </button>
                  </div>
                  <Field label={form.taxpayerType === "pj" ? "CNPJ" : "CPF"}>
                    <Input
                      value={form.cpf}
                      inputMode="numeric"
                      placeholder={form.taxpayerType === "pj" ? "00.000.000/0000-00" : "000.000.000-00"}
                      onChange={(event) => setField("cpf", event.target.value)}
                      className="h-12 rounded-[16px]"
                    />
                  </Field>
                  <Field label="Nascimento"><Input type="date" value={form.birthDate} onChange={(event) => setField("birthDate", event.target.value)} className="h-12 rounded-[16px]" /></Field>
                  <Field label="Telefone"><Input value={form.phone} inputMode="tel" onChange={(event) => setField("phone", event.target.value)} className="h-12 rounded-[16px]" /></Field>
                </>
              ) : null}

              {step === "business" ? (
                <>
                  <div className="grid grid-cols-[1fr_.45fr] gap-3">
                    <Field label="CEP"><Input value={form.cep} inputMode="numeric" onChange={(event) => setField("cep", event.target.value)} className="h-12 rounded-[16px]" /></Field>
                    <Field label="UF"><Input value={form.state} onChange={(event) => setField("state", event.target.value)} className="h-12 rounded-[16px] uppercase" /></Field>
                  </div>
                  <Field label="Rua"><Input value={form.street} onChange={(event) => setField("street", event.target.value)} className="h-12 rounded-[16px]" /></Field>
                  <MobileAddressSuggestions
                    suggestions={addressSuggestions}
                    loading={addressLoading || addressValidating}
                    error={addressError}
                    onSelect={(suggestion) => void selectAddress(suggestion)}
                  />
                  <div className="grid grid-cols-[.45fr_1fr] gap-3">
                    <Field label="Número"><Input value={form.number} onChange={(event) => setField("number", event.target.value)} className="h-12 rounded-[16px]" /></Field>
                    <Field label="Bairro"><Input value={form.neighborhood} onChange={(event) => setField("neighborhood", event.target.value)} className="h-12 rounded-[16px]" /></Field>
                  </div>
                  <Field label="Cidade"><Input value={form.city} onChange={(event) => setField("city", event.target.value)} className="h-12 rounded-[16px]" /></Field>
                  <Field label="Tipo de empresa">
                    <div className="grid grid-cols-2 gap-2">
                      {companyTypes.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setField("companyType", type.value)}
                          className={cn(
                            "min-h-11 rounded-[15px] border px-3 text-left text-[9px] font-black uppercase tracking-[0.08em] transition active:scale-[0.985]",
                            form.companyType === type.value
                              ? "border-foreground bg-foreground text-background"
                              : "border-border/55 bg-background/70 text-foreground dark:border-white/10",
                          )}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Faturamento mensal"><Input value={form.incomeValue} inputMode="decimal" placeholder="5.000,00" onChange={(event) => setField("incomeValue", event.target.value)} className="h-12 rounded-[16px]" /></Field>
                  <Field label="Descrição clínica"><textarea value={form.businessDescription} onChange={(event) => setField("businessDescription", event.target.value)} className="min-h-28 w-full resize-none rounded-[18px] border border-input bg-background px-4 py-3 text-sm outline-none" /></Field>
                  <Field label="Site ou perfil profissional"><Input value={form.businessUrl} onChange={(event) => setField("businessUrl", event.target.value)} className="h-12 rounded-[16px]" /></Field>
                </>
              ) : null}

              {step === "bank" ? (
                <>
                  <div className="grid gap-2">
                    {payoutOptions.map((option) => {
                      const Icon = option.icon;
                      const active = form.payoutMethod === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setField("payoutMethod", option.id)}
                          className={cn(
                            "flex items-center gap-3 rounded-[20px] border p-3 text-left transition active:scale-[0.985]",
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border/55 bg-background/65 dark:border-white/10"
                          )}
                        >
                          <span className={cn("flex h-11 w-11 items-center justify-center rounded-[15px]", active ? "bg-background/14" : "bg-foreground/[0.06]")}>
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-black">{option.label}</span>
                            <span className={cn("mt-1 block text-[10px] font-semibold leading-snug", active ? "text-background/70" : "text-muted-foreground")}>
                              {option.helper}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {(form.payoutMethod === "pix" || form.payoutMethod === "both") ? (
                    <div className="space-y-3 rounded-[22px] border border-border/45 bg-background/65 p-3 dark:border-white/10">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">Chave Pix</p>
                      <div className="grid grid-cols-3 gap-2">
                        {pixKeyTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setPixKeyType(type.value)}
                            className={cn(
                              "h-10 rounded-[14px] border text-[9px] font-black uppercase tracking-[0.08em]",
                              form.pixKeyType === type.value
                                ? "border-foreground bg-foreground text-background"
                                : "border-border/55 bg-background dark:border-white/10"
                            )}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                      <Input
                        value={form.pixKey}
                        placeholder={pixKeyTypes.find((type) => type.value === form.pixKeyType)?.hint}
                        onChange={(event) => setField("pixKey", event.target.value)}
                        className="h-12 rounded-[16px]"
                      />
                    </div>
                  ) : null}

                  {(form.payoutMethod === "bank" || form.payoutMethod === "both") ? (
                    <div className="space-y-3 rounded-[22px] border border-border/45 bg-background/65 p-3 dark:border-white/10">
                      <Field label="Código do banco"><Input value={form.bankCode} inputMode="numeric" placeholder="001" onChange={(event) => setField("bankCode", event.target.value)} className="h-12 rounded-[16px]" /></Field>
                      <Field label="Agência"><Input value={form.agency} inputMode="numeric" placeholder="0001-0" onChange={(event) => setField("agency", event.target.value)} className="h-12 rounded-[16px]" /></Field>
                      <Field label="Conta com dígito"><Input value={form.accountNumber} inputMode="numeric" placeholder="123456-7" onChange={(event) => setField("accountNumber", event.target.value)} className="h-12 rounded-[16px]" /></Field>
                      <p className="rounded-[18px] border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] font-semibold leading-relaxed text-amber-700 dark:text-amber-300">A conta bancária precisa ter a mesma titularidade do documento informado.</p>
                    </div>
                  ) : null}

                  <MobileFeePreview items={feeCards} />
                </>
              ) : null}

              {step === "documents" ? (
                <div className="grid gap-3">
                  <DocumentButton
                    label="Frente do documento"
                    file={frontFile}
                    onCapture={() => frontCameraRef.current?.click()}
                    onPick={() => frontRef.current?.click()}
                  />
                  <DocumentButton
                    label="Verso do documento"
                    file={backFile}
                    optional
                    onCapture={() => backCameraRef.current?.click()}
                    onPick={() => backRef.current?.click()}
                  />
                  <input ref={frontCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => setFrontFile(event.target.files?.[0] || null)} />
                  <input ref={backCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => setBackFile(event.target.files?.[0] || null)} />
                  <input ref={frontRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => setFrontFile(event.target.files?.[0] || null)} />
                  <input ref={backRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => setBackFile(event.target.files?.[0] || null)} />
                </div>
              ) : null}

              {step === "review" ? (
                <div className="space-y-3">
                  <ReviewRow label="Titular" value={`${form.firstName} ${form.lastName}`} />
                  <ReviewRow label={form.taxpayerType === "pj" ? "CNPJ" : "CPF"} value={form.cpf} />
                  <ReviewRow label="Cidade" value={`${form.city}/${form.state}`} />
                  <ReviewRow label="Faturamento" value={formatMoney(parseIncome(form.incomeValue))} />
                  {(form.payoutMethod === "pix" || form.payoutMethod === "both") ? (
                    <ReviewRow label="Pix" value={`${pixKeyTypes.find((type) => type.value === form.pixKeyType)?.label}: ${form.pixKey}`} />
                  ) : null}
                  {(form.payoutMethod === "bank" || form.payoutMethod === "both") ? (
                    <ReviewRow label="Banco" value={`${form.bankCode} · ${form.agency} · ${form.accountNumber}`} />
                  ) : null}
                  <label className="flex items-start gap-3 rounded-[18px] border border-border/45 bg-background/65 p-3 text-[11px] font-semibold leading-relaxed">
                    <input type="checkbox" checked={form.tosAccepted} onChange={(event) => setField("tosAccepted", event.target.checked)} className="mt-1" />
                    Autorizo o envio dos dados para validação KYC e abertura da conta conectada NeuroFinance.
                  </label>
                </div>
              ) : null}
            </div>
          </div>

          <footer className="grid shrink-0 grid-cols-[.8fr_1.2fr] gap-3 border-t border-border/45 bg-[#f8f8f6]/92 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#020202]/92">
            <Button variant="outline" onClick={back} disabled={saving} className="h-[52px] rounded-[18px] text-[10px] font-black uppercase tracking-[0.12em]">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={next} disabled={saving} className="h-[52px] rounded-[18px] text-[10px] font-black uppercase tracking-[0.12em]">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : step === "review" ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              {step === "review" ? "Enviar" : "Continuar"}
            </Button>
          </footer>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function MobileAddressSuggestions({
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
    <div className="rounded-[20px] border border-border/45 bg-background/70 p-3 dark:border-white/10">
      {loading ? (
        <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Buscando endereço...
        </div>
      ) : null}

      {!loading && suggestions.length > 0 ? (
        <div className="grid gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => onSelect(suggestion)}
              className="flex min-h-14 items-start gap-3 rounded-[16px] border border-border/35 bg-background px-3 py-2 text-left active:scale-[0.99] dark:border-white/10"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-xs font-black leading-snug">{suggestion.label}</span>
                <span className="mt-1 block text-[8px] font-black uppercase tracking-[0.1em] text-muted-foreground">
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
        <p className="text-[11px] font-semibold leading-snug text-muted-foreground">{error}</p>
      ) : null}
    </div>
  );
}

function MobileBrandSeal({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/70 px-3 py-2 dark:border-white/10", className)}>
      <img src="/favicon-dark.png" alt="" className="h-4 w-4 dark:hidden" />
      <img src="/favicon-light.png" alt="" className="hidden h-4 w-4 dark:block" />
      <span className="text-[8px] font-black uppercase tracking-[0.18em]">NeuroNex</span>
      <span className="h-3 w-px bg-border dark:bg-white/15" />
      <AsaasStamp className="scale-[0.68] origin-left opacity-75" />
    </div>
  );
}

function MobileFeePreview({
  items,
}: {
  items: Array<{ key: string; title: string; price: string; settlement: string }>;
}) {
  return (
    <div className="rounded-[22px] border border-border/45 bg-background/65 p-3 dark:border-white/10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">Taxas e prazos</p>
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div key={item.key} className="rounded-[16px] border border-border/35 bg-background p-3 dark:border-white/10">
            <p className="text-[9px] font-black uppercase tracking-[0.08em] text-muted-foreground/75">{item.settlement}</p>
            <p className="mt-2 text-xs font-black">{item.title}</p>
            <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{item.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentButton({
  label,
  file,
  optional,
  onCapture,
  onPick,
}: {
  label: string;
  file: File | null;
  optional?: boolean;
  onCapture: () => void;
  onPick: () => void;
}) {
  return (
    <div className="rounded-[22px] border border-dashed border-border/70 bg-background/65 p-4 text-left dark:border-white/10">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-foreground/[0.06]">
          {file ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <FileUp className="h-5 w-5 text-muted-foreground" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black">{label}</p>
          <p className="mt-1 truncate text-[10px] font-semibold text-muted-foreground">{file?.name || (optional ? "Opcional quando aplicável" : "PNG, JPG ou PDF")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={onCapture} className="h-11 rounded-[15px] text-[9px] font-black uppercase tracking-[0.08em]">
          <Camera className="mr-2 h-4 w-4" />
          Foto
        </Button>
        <Button type="button" variant="outline" onClick={onPick} className="h-11 rounded-[15px] text-[9px] font-black uppercase tracking-[0.08em]">
          <FileUp className="mr-2 h-4 w-4" />
          Arquivo
        </Button>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[16px] border border-border/35 bg-background/65 p-3 dark:border-white/10">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="max-w-[58%] text-right text-xs font-black">{value || "-"}</span>
    </div>
  );
}
