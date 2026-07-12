"use client";

import { type ComponentProps, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { differenceInYears, format, isValid } from "date-fns";
import { Check, CircleHelp, Loader2, Plus, Save, X } from "lucide-react";
import { type Path, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAddPatient } from "@/hooks/use-add-patient";
import { useAddressAutocomplete } from "@/hooks/use-address-autocomplete";
import {
  formatCentsAsBRL,
  parseMoneyToCents,
  type InsuranceRepassType,
  type PatientInsuranceAgreement,
  usePatientInsuranceAgreements,
} from "@/hooks/use-patient-insurance-agreements";
import { usePatientLookupOptions, type PatientLookupOption } from "@/hooks/use-patient-lookup-options";
import { usePatientRecordDetails, type PatientRecordDetails } from "@/hooks/use-patient-record-details";
import { useProfile } from "@/hooks/use-profile";
import { useUpdatePatientRecord } from "@/hooks/use-update-patient-record";
import { cn } from "@/lib/utils";
import { NewPatientFormValues, NewPatientSchema } from "@/lib/validation";
import type { Patient } from "@/types";

interface NewPatientFormProps {
  onSuccess: (patient?: Patient) => void;
  onCancel?: () => void;
  patient?: Patient | null;
}

const GROUP_OPTIONS = [
  { value: "adult", label: "Adulto" },
  { value: "child", label: "Crianças" },
  { value: "adolescent", label: "Adolescentes" },
  { value: "elderly", label: "Idosos" },
];

const GENDER_OPTIONS = [
  { value: "male", label: "Masculino" },
  { value: "female", label: "Feminino" },
  { value: "agender", label: "Agênero" },
  { value: "gender_fluid", label: "Gênero Fluido" },
  { value: "non_binary", label: "Não Binário" },
  { value: "transgender", label: "Transgênero" },
  { value: "prefer_not_to_say", label: "Prefere não informar" },
  { value: "other", label: "Outro" },
];

const FINANCIAL_PLAN_OPTIONS = [
  { value: "per_session", label: "Por sessão" },
  { value: "monthly", label: "Por mês (mensalista)" },
  { value: "insurance", label: "Convênio" },
  { value: "exempt", label: "Isento" },
];

const STATE_OPTIONS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];

const EDUCATION_OPTIONS = [
  "Fundamental Incompleto",
  "Fundamental Completo",
  "Médio Incompleto",
  "Médio Completo",
  "Superior Incompleto",
  "Superior Completo",
  "Mestre",
  "Doutor",
  "Pós Doutor",
  "Pós Graduação",
  "Infantil ou Jardim",
];

const RACE_OPTIONS = [
  "Branco(a)",
  "Preto(a)",
  "Amarelo(a)",
  "Pardo(a)",
  "Indígena",
  "Prefere não informar",
];

const inputClassName =
  "h-11 rounded-md border-border bg-background text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";

const labelClassName = "text-[0.8125rem] font-semibold leading-none text-foreground";
const subtleLabelClassName = "text-[0.7rem] font-semibold uppercase tracking-normal text-muted-foreground";
const helperTextClassName = "text-xs leading-relaxed text-muted-foreground";
const selectTriggerClassName = cn(inputClassName, "justify-between");

const asDateInputValue = (date?: Date) => {
  if (!date || !isValid(date)) return "";
  return format(date, "yyyy-MM-dd");
};

const fromDateInputValue = (value: string) => {
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return isValid(date) ? date : undefined;
};

const dateFromDatabase = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return isValid(date) ? date : undefined;
};

const onlyDigits = (value?: string | null) => value?.replace(/\D/g, "") || "";

const formatCpfInput = (value: string) =>
  onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const formatCepInput = (value: string) =>
  onlyDigits(value)
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");

const formatCountryCodeInput = (value: string) => {
  const digits = onlyDigits(value).slice(0, 3);
  return digits ? `+${digits}` : "+";
};

const formatPhoneInput = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const formatCurrencyInput = (value: string) => {
  const digits = onlyDigits(value);
  const cents = Number(digits || "0");
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatPercentInput = (value: string) => {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const number = Number(normalized);
  if (!Number.isFinite(number)) return "";
  return String(Math.min(100, Math.max(0, number)));
};

const formatDayInput = (value: string) => {
  const digits = onlyDigits(value).slice(0, 2);
  if (!digits) return "";
  return String(Math.min(31, Math.max(1, Number(digits))));
};

const formatIntegerInput = (value: string) => onlyDigits(value).slice(0, 4);

const fieldFormatters: Partial<Record<Path<NewPatientFormValues>, (value: string) => string>> = {
  phone_country_code: formatCountryCodeInput,
  mobile_phone: formatPhoneInput,
  phone: formatPhoneInput,
  landline_phone: formatPhoneInput,
  cpf: formatCpfInput,
  postal_code: formatCepInput,
  relative_phone: formatPhoneInput,
  responsible_phone_country_code: formatCountryCodeInput,
  responsible_mobile_phone: formatPhoneInput,
  responsible_cpf: formatCpfInput,
  emergency_phone: formatPhoneInput,
  payer_cpf: formatCpfInput,
  session_value: formatCurrencyInput,
  monthly_value: formatCurrencyInput,
  insurance_session_value: formatCurrencyInput,
  billing_day: formatDayInput,
};

const centsToMoneyInput = (value?: number | null) => {
  if (!value) return "0,00";
  return (value / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const buildPatientFormDefaults = (
  patient: Patient | null | undefined,
  details: PatientRecordDetails | undefined,
  professionalName: string,
): NewPatientFormValues => {
  const financial = details?.financial;
  const responsible = details?.responsible;
  const financialPlan = (financial?.plan_type as NewPatientFormValues["financial_plan"] | undefined) || "per_session";

  return {
    quick_registration: patient?.quick_registration ?? true,
    name: patient?.name || "",
    group_type: (patient?.group_type as NewPatientFormValues["group_type"] | undefined) || "adult",
    email: patient?.email || "",
    phone_country_code: patient?.phone_country_code || "+55",
    mobile_phone: patient?.mobile_phone || patient?.phone || "",
    phone: patient?.phone || "",
    landline_phone: patient?.landline_phone || "",
    cpf: formatCpfInput(patient?.cpf || ""),
    rg: patient?.rg || "",
    birth_date: dateFromDatabase(patient?.birth_date),
    gender_identity: (patient?.gender_identity as NewPatientFormValues["gender_identity"] | undefined) || "male",
    has_social_name: patient?.has_social_name ?? false,
    social_name: patient?.social_name || "",
    notes: patient?.notes || "",
    professional_name: financial?.professional_name || professionalName,
    financial_plan: financialPlan,
    session_value: centsToMoneyInput(financial?.session_value_cents),
    monthly_value: centsToMoneyInput(financial?.monthly_value_cents),
    billing_day: financial?.billing_day ? String(financial.billing_day) : "",
    insurance_agreement_id: financial?.insurance_agreement_id || "__none",
    insurance_session_value: centsToMoneyInput(financial?.session_value_cents),
    insurance_card_number: financial?.insurance_card_number || "",
    insurance_card_expires_at: dateFromDatabase(financial?.insurance_card_expires_at),
    country: patient?.country || "Brasil",
    postal_code: formatCepInput(patient?.postal_code || ""),
    city: patient?.city || "",
    state: patient?.state || "",
    street: patient?.street || "",
    street_number: patient?.street_number || "",
    neighborhood: patient?.neighborhood || "",
    complement: patient?.complement || "",
    address: patient?.address || "",
    naturality: patient?.naturality || "",
    education_level: patient?.education_level || "",
    race: patient?.race || "",
    profession: patient?.profession || "",
    relative_name: patient?.relative_name || "",
    relative_relationship: patient?.relative_relationship || "",
    relative_phone: formatPhoneInput(patient?.relative_phone || ""),
    referrer_option_id: patient?.referred_by_option_id || "__none",
    responsible_name: responsible?.name || "",
    responsible_email: responsible?.email || "",
    responsible_phone_country_code: responsible?.phone_country_code || "+55",
    responsible_mobile_phone: formatPhoneInput(responsible?.mobile_phone || ""),
    responsible_cpf: formatCpfInput(responsible?.cpf || ""),
    responsible_rg: responsible?.rg || "",
    responsible_birth_date: dateFromDatabase(responsible?.birth_date),
    responsible_use_for_billing_documents: Boolean(responsible?.use_for_billing_documents),
    diagnosis: patient?.diagnosis || "",
    emergency_name: "",
    emergency_phone: "",
    payer_type: patient?.payer_type || "patient",
    payer_name: patient?.payer_name || "",
    payer_cpf: formatCpfInput(patient?.payer_cpf || ""),
    medications: patient?.medications || [],
  };
};

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) => (
  <section className="desktop-retina-inset rounded-[24px] border border-border p-5 md:p-6">
    <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]">
      <div className="space-y-2">
        <h3 className="text-base font-semibold leading-tight tracking-normal text-foreground">{title}</h3>
        {description ? <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  </section>
);

const FieldShell = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn("min-w-0", className)}>{children}</div>
);

const LookupSelect = ({
  label,
  value,
  placeholder,
  options,
  isAdding,
  onChange,
  onAdd,
}: {
  label: string;
  value?: string;
  placeholder: string;
  options: PatientLookupOption[];
  isAdding: boolean;
  onChange: (value: string) => void;
  onAdd: (label: string) => Promise<unknown>;
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const handleCreate = async () => {
    const labelValue = newLabel.trim();
    if (!labelValue) return;
    const created = (await onAdd(labelValue)) as PatientLookupOption;
    onChange(created.id);
    setNewLabel("");
    setIsCreating(false);
  };

  return (
    <FieldShell>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={labelClassName}>{label}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-md"
          onClick={() => setIsCreating((current) => !current)}
          aria-label={`Adicionar ${label.toLowerCase()}`}
        >
          {isCreating ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <Select value={value || "__none"} onValueChange={(next) => onChange(next === "__none" ? "" : next)}>
        <SelectTrigger className={selectTriggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Selecione</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isCreating ? (
        <div className="mt-2 grid grid-cols-[1fr_2.75rem] gap-2">
          <Input
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="Digite aqui"
            className={inputClassName}
          />
          <Button type="button" disabled={isAdding} className="h-11 rounded-lg px-0" onClick={handleCreate}>
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
        </div>
      ) : null}
    </FieldShell>
  );
};

const InsuranceAgreementWizard = ({
  open,
  isPending,
  onClose,
  onCreate,
}: {
  open: boolean;
  isPending: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    repassType: InsuranceRepassType;
    repassValue: string;
    expectedReceiptDays: string;
  }) => Promise<PatientInsuranceAgreement>;
}) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [repassType, setRepassType] = useState<InsuranceRepassType>("currency");
  const [repassValue, setRepassValue] = useState("");
  const [expectedReceiptDays, setExpectedReceiptDays] = useState("");

  if (!open) return null;

  const reset = () => {
    setStep(1);
    setName("");
    setRepassType("currency");
    setRepassValue("");
    setExpectedReceiptDays("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome do convênio.");
      setStep(1);
      return;
    }
    if (!repassValue.trim()) {
      toast.error("Informe o valor do repasse.");
      return;
    }

    await onCreate({ name, repassType, repassValue, expectedReceiptDays });
    reset();
    onClose();
  };

  return (
    <div className="sm:col-span-2 xl:col-span-3">
      <div className="rounded-lg border border-border bg-background p-4 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold text-foreground">Adicionar convênio</h4>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre o convênio e suas regras de repasse.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-full" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_1fr] items-center gap-3">
          {[1, 2].map((item) => (
            <div key={item} className="space-y-2">
              <div className={cn("h-1.5 rounded-full", step >= item ? "bg-foreground" : "bg-muted")} />
              <p className={cn("text-xs font-medium", step === item ? "text-foreground" : "text-muted-foreground")}>
                {item === 1 ? "Nome do convênio" : "Regras de repasse"}
              </p>
            </div>
          ))}
        </div>

        {step === 1 ? (
          <div className="mt-5 space-y-2">
            <label className={labelClassName} htmlFor="insurance-name">Nome do convênio</label>
            <Input
              id="insurance-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Digite aqui"
              className={inputClassName}
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClassName} htmlFor="insurance-name-review">Nome do convênio</label>
              <Input id="insurance-name-review" value={name} onChange={(event) => setName(event.target.value)} className={inputClassName} />
            </div>
            <div className="space-y-2">
              <label className={labelClassName}>Repasse pago pelo convênio em</label>
              <Select
                value={repassType}
                onValueChange={(value) => {
                  const nextType = value as InsuranceRepassType;
                  setRepassType(nextType);
                  setRepassValue((current) => nextType === "currency" ? formatCurrencyInput(current) : formatPercentInput(current));
                }}
              >
                <SelectTrigger className={selectTriggerClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="currency">R$</SelectItem>
                  <SelectItem value="percentage">%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className={labelClassName} htmlFor="insurance-repass-value">Valor</label>
              <Input
                id="insurance-repass-value"
                value={repassValue}
                onChange={(event) => {
                  setRepassValue(
                    repassType === "currency"
                      ? formatCurrencyInput(event.target.value)
                      : formatPercentInput(event.target.value),
                  );
                }}
                placeholder={repassType === "currency" ? "R$ 0,00" : "0 a 100%"}
                inputMode="decimal"
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClassName} htmlFor="insurance-receipt-days">Dias previstos para recebimento</label>
              <Input
                id="insurance-receipt-days"
                value={expectedReceiptDays}
                onChange={(event) => setExpectedReceiptDays(formatIntegerInput(event.target.value))}
                placeholder="Ex.: 30"
                inputMode="numeric"
                className={inputClassName}
              />
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 rounded-md px-6" onClick={step === 1 ? handleClose : () => setStep(1)}>
            {step === 1 ? "Cancelar" : "Voltar"}
          </Button>
          <Button
            type="button"
            className="h-11 rounded-md px-6"
            disabled={isPending}
            onClick={step === 1 ? () => {
              if (!name.trim()) {
                toast.error("Informe o nome do convênio.");
                return;
              }
              setStep(2);
            } : handleCreate}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {step === 1 ? "Próximo" : "Salvar convênio"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const NewPatientForm = ({ onSuccess, onCancel, patient = null }: NewPatientFormProps) => {
  const addPatient = useAddPatient();
  const updatePatient = useUpdatePatientRecord();
  const { data: profile } = useProfile();
  const isEditing = Boolean(patient?.id);
  const patientRecordDetails = usePatientRecordDetails(patient?.id);
  const referrerOptions = usePatientLookupOptions("referrer");
  const insuranceAgreements = usePatientInsuranceAgreements();
  const [insuranceWizardOpen, setInsuranceWizardOpen] = useState(false);
  const [selectedAddressQuery, setSelectedAddressQuery] = useState("");
  const [autoAppliedCep, setAutoAppliedCep] = useState("");

  const professionalName = useMemo(() => {
    const parts = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
    return profile?.full_name || profile?.name || parts || "";
  }, [profile]);

  const defaultValues = useMemo(
    () => buildPatientFormDefaults(patient, patientRecordDetails.data, professionalName),
    [patient, patientRecordDetails.data, professionalName],
  );

  const form = useForm<NewPatientFormValues>({
    resolver: zodResolver(NewPatientSchema),
    defaultValues,
  });

  useEffect(() => {
    if (isEditing) return;
    form.setValue("professional_name", professionalName, { shouldDirty: false });
  }, [form, isEditing, professionalName]);

  useEffect(() => {
    if (!isEditing || patientRecordDetails.isLoading) return;
    form.reset(defaultValues);
    setAutoAppliedCep(onlyDigits(defaultValues.postal_code));
    setSelectedAddressQuery(onlyDigits(defaultValues.postal_code));
  }, [defaultValues, form, isEditing, patientRecordDetails.isLoading]);

  const quickRegistration = form.watch("quick_registration");
  const hasSocialName = form.watch("has_social_name");
  const birthDate = form.watch("birth_date");
  const notes = form.watch("notes") || "";
  const financialPlan = form.watch("financial_plan");
  const insuranceAgreementId = form.watch("insurance_agreement_id");
  const insuranceSessionValue = form.watch("insurance_session_value");
  const postalCode = form.watch("postal_code") || "";

  const addressLookupQuery = useMemo(() => {
    const cepDigits = onlyDigits(postalCode);
    return cepDigits.length >= 8 ? cepDigits : "";
  }, [postalCode]);

  const {
    suggestions: addressSuggestions,
    isLoading: addressLoading,
    isValidating: addressValidating,
    error: addressError,
    validateSuggestion,
    clearSuggestions,
  } = useAddressAutocomplete(addressLookupQuery, selectedAddressQuery);

  const isPending = addPatient.isPending || updatePatient.isPending;
  const isFormLoading = isEditing && patientRecordDetails.isLoading;

  const selectedInsuranceAgreement = (insuranceAgreements.data || []).find((item) => item.id === insuranceAgreementId);
  const insuranceSessionCents = parseMoneyToCents(insuranceSessionValue);
  const calculatedRepassCents = selectedInsuranceAgreement
    ? selectedInsuranceAgreement.repass_type === "currency"
      ? selectedInsuranceAgreement.repass_value_cents || 0
      : Math.round(insuranceSessionCents * ((selectedInsuranceAgreement.repass_percentage || 0) / 100))
    : 0;

  const ageLabel = birthDate && isValid(birthDate)
    ? `${differenceInYears(new Date(), birthDate)} anos`
    : "Digite a data de nascimento";

  const applyAddressSuggestion = useCallback(async () => {
    const cepDigits = onlyDigits(postalCode);
    const suggestion =
      addressSuggestions.find((item) => item.source === "viacep") ||
      (addressSuggestions.length === 1 ? addressSuggestions[0] : null);

    if (!suggestion || cepDigits.length !== 8) return;

    try {
      const address = await validateSuggestion(suggestion);
      const resolvedCep = formatCepInput(address.postalCode || postalCode);
      if (resolvedCep) form.setValue("postal_code", resolvedCep, { shouldDirty: true, shouldValidate: true });
      if (address.street) form.setValue("street", address.street, { shouldDirty: true });
      if (address.neighborhood) form.setValue("neighborhood", address.neighborhood, { shouldDirty: true });
      if (address.city) form.setValue("city", address.city, { shouldDirty: true });
      if (address.state) form.setValue("state", address.state.toUpperCase().slice(0, 2), { shouldDirty: true });
      setSelectedAddressQuery(onlyDigits(address.postalCode || "") || address.label);
      setAutoAppliedCep(cepDigits);
      clearSuggestions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao conseguimos validar este CEP.");
    }
  }, [addressSuggestions, clearSuggestions, form, postalCode, validateSuggestion]);

  useEffect(() => {
    const cepDigits = onlyDigits(postalCode);
    if (cepDigits.length !== 8 || autoAppliedCep === cepDigits || addressValidating) return;
    void applyAddressSuggestion();
  }, [addressValidating, autoAppliedCep, applyAddressSuggestion, postalCode]);

  const renderTextField = (
    name: Path<NewPatientFormValues>,
    label: string,
    props?: ComponentProps<typeof Input> & { className?: string },
    className?: string,
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className={label ? labelClassName : "sr-only"}>
            {label || props?.["aria-label"] || String(name)}
          </FormLabel>
          <FormControl>
            <Input
              {...props}
              {...field}
              value={(field.value as string) || ""}
              onChange={(event) => {
                const formatter = fieldFormatters[name];
                field.onChange(formatter ? formatter(event.target.value) : event.target.value);
                if (name === "postal_code") {
                  setSelectedAddressQuery("");
                  setAutoAppliedCep("");
                }
              }}
              className={cn(inputClassName, props?.className)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const renderPhoneField = (
    codeName: keyof NewPatientFormValues,
    phoneName: keyof NewPatientFormValues,
    label: string,
    placeholder = "+55 (00) 00000-0000",
  ) => (
    <div className="space-y-2">
      <span className={labelClassName}>{label}</span>
      <div className="grid grid-cols-[4.5rem_1fr] gap-2">
        {renderTextField(codeName, "", { placeholder: "+55", "aria-label": `${label} DDI` })}
        {renderTextField(phoneName, "", { placeholder, "aria-label": label })}
      </div>
    </div>
  );

  const renderSelectField = (
    name: Path<NewPatientFormValues>,
    label: ReactNode,
    options: Array<{ value: string; label: string }>,
    placeholder = "Selecione",
    className?: string,
    description?: string,
    optional = false,
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className={cn(labelClassName, "flex items-center gap-1.5")}>{label}</FormLabel>
          <Select
            value={(field.value as string) || (optional ? "__none" : "")}
            onValueChange={(value) => field.onChange(value === "__none" ? "" : value)}
          >
            <FormControl>
              <SelectTrigger className={selectTriggerClassName}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {optional ? <SelectItem value="__none">Selecione</SelectItem> : null}
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FormDescription className="text-xs">{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const renderDateField = (name: Path<NewPatientFormValues>, label: string, className?: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className={labelClassName}>{label}</FormLabel>
          <FormControl>
            <Input
              type="date"
              value={asDateInputValue(field.value as Date | undefined)}
              onChange={(event) => field.onChange(fromDateInputValue(event.target.value))}
              className={inputClassName}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const groupLabel = (
    <>
      Grupo
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground">
            <CircleHelp className="h-3.5 w-3.5" />
            <span className="sr-only">Ajuda sobre grupo</span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-80">
          Selecione um grupo abaixo ou acesse: Configurações -&gt; Modelos -&gt; Anamnese para adicionar um novo
        </TooltipContent>
      </Tooltip>
    </>
  );

  const handleSubmitError = (error: Error, fallback: string) => {
    const message = error.message || fallback;
    if (message.toLowerCase().includes("e-mail") || message.toLowerCase().includes("email")) {
      form.setError("email", { message });
    }
    toast.error(message);
  };

  const onSubmit = (values: NewPatientFormValues) => {
    if (isEditing && patient?.id) {
      updatePatient.mutate(
        { patientId: patient.id, patientData: values },
        {
          onSuccess: (updatedPatient) => {
            toast.success("Prontuario atualizado com sucesso!");
            onSuccess(updatedPatient);
          },
          onError: (error) => handleSubmitError(error, "Erro ao atualizar paciente."),
        },
      );
      return;
    }

    addPatient.mutate(values, {
      onSuccess: (createdPatient) => {
        toast.success("Prontuário criado com sucesso!");
        form.reset(buildPatientFormDefaults(null, undefined, professionalName));
        onSuccess(createdPatient);
      },
      onError: (error) => handleSubmitError(error, "Erro ao adicionar paciente."),
    });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="desktop-retina-form flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5 sm:px-6 lg:px-8">
              <div className="desktop-retina-inset flex flex-col gap-3 rounded-[22px] border border-border bg-background p-4 shadow-none sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">Cadastro rápido</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Ative para mostrar só os campos essenciais. Desative para abrir o cadastro completo.
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="quick_registration"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormLabel className={subtleLabelClassName}>{field.value ? "Ativo" : "Completo"}</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Section
                title={quickRegistration ? "Informações pessoais do cadastro rápido" : "Informações pessoais"}
                description={quickRegistration ? "Campos essenciais para criar o prontuário sem atrito." : "Dados pessoais usados no prontuário e na anamnese."}
              >
                {renderTextField("name", "Nome completo", { placeholder: "Digite aqui", maxLength: 100 })}
                {renderSelectField("group_type", groupLabel, GROUP_OPTIONS, "Adulto", undefined, "Utilizado para importar o formulário de anamnese")}
                {renderTextField("email", "E-mail", { placeholder: "Digite aqui", maxLength: 100, type: "email" })}
                {renderPhoneField("phone_country_code", "mobile_phone", "Celular")}
                {renderTextField("cpf", "CPF", { placeholder: "000.000.000-00", maxLength: 100 })}
                {renderTextField("rg", "RG", { placeholder: "Digite aqui", maxLength: 100 })}
                {!quickRegistration ? (
                  <>
                    {renderTextField("landline_phone", "Telefone", { placeholder: "(00) 0000-0000" })}
                    {renderDateField("birth_date", "Data de nascimento")}
                    <FormItem>
                      <FormLabel className={labelClassName}>Idade</FormLabel>
                      <Input disabled value={ageLabel} className={cn(inputClassName, "disabled:opacity-100")} />
                    </FormItem>
                  </>
                ) : null}
                {renderSelectField("gender_identity", "Gênero", GENDER_OPTIONS, "Masculino")}
                <FormField
                  control={form.control}
                  name="has_social_name"
                  render={({ field }) => (
                    <FormItem className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
                      <FormLabel className={cn(labelClassName, "flex items-center gap-1.5")}>
                        Cliente possui nome social?
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground">
                              <CircleHelp className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Quando habilitado, o campo de nome social aparece abaixo.</TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {hasSocialName ? renderTextField("social_name", "Nome social", { placeholder: "Digite aqui", maxLength: 100 }) : null}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2 xl:col-span-3">
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel className={labelClassName}>Observações</FormLabel>
                        <span className="text-xs text-muted-foreground">
                          {quickRegistration ? `${notes.length} de 400 caracteres` : "Limite de 10.000 caracteres"}
                        </span>
                      </div>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Digite aqui"
                          maxLength={quickRegistration ? 400 : 10000}
                          className={cn(inputClassName, "min-h-24 resize-y py-3 leading-relaxed")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Section>

              {!quickRegistration ? (
                <>
                  <Section title="Informações financeiras" description="Configuração inicial de cobrança e relacionamento financeiro do paciente.">
                    <div className="rounded-md border border-border bg-background px-3 py-3">
                      <p className={subtleLabelClassName}>Profissional</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {professionalName || "Nao informado no perfil"}
                      </p>
                      {!professionalName ? (
                        <p className={cn(helperTextClassName, "mt-1")}>
                          O cadastro sera salvo sem nome profissional preenchido.
                        </p>
                      ) : null}
                    </div>
                    {renderSelectField("financial_plan", "Plano financeiro", FINANCIAL_PLAN_OPTIONS, "Por sessão")}

                    {financialPlan === "per_session" ? (
                      renderTextField("session_value", "Valor da sessão", { placeholder: "R$ 0,00", inputMode: "decimal" })
                    ) : null}

                    {financialPlan === "monthly" ? (
                      <>
                        {renderTextField("monthly_value", "Valor da mensalidade", { placeholder: "R$ 0,00", inputMode: "decimal" })}
                        {renderTextField("billing_day", "Dia de vencimento", { placeholder: "Ex.: 10", inputMode: "numeric", maxLength: 2 })}
                      </>
                    ) : null}

                    {financialPlan === "insurance" ? (
                      <>
                        <FormField
                          control={form.control}
                          name="insurance_agreement_id"
                          render={({ field }) => (
                            <FormItem>
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <FormLabel className={labelClassName}>Convênio</FormLabel>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-11 w-11 rounded-md"
                                  onClick={() => setInsuranceWizardOpen(true)}
                                  aria-label="Adicionar convênio"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              <Select
                                value={(field.value as string) || "__none"}
                                onValueChange={(value) => field.onChange(value === "__none" ? "" : value)}
                              >
                                <FormControl>
                                  <SelectTrigger className={selectTriggerClassName}>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="__none">Selecione</SelectItem>
                                  {(insuranceAgreements.data || []).map((agreement) => (
                                    <SelectItem key={agreement.id} value={agreement.id}>
                                      {agreement.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {renderTextField("insurance_session_value", "Valor da sessão (sem convênio)", { placeholder: "R$ 0,00", inputMode: "decimal" })}
                        <FormItem>
                          <FormLabel className={labelClassName}>Valor calculado do repasse</FormLabel>
                          <Input disabled value={formatCentsAsBRL(calculatedRepassCents)} className={cn(inputClassName, "disabled:opacity-100")} />
                        </FormItem>
                        {renderTextField("insurance_card_number", "Número da carteirinha", { placeholder: "Digite aqui" })}
                        {renderDateField("insurance_card_expires_at", "Data de expiração")}
                        <InsuranceAgreementWizard
                          open={insuranceWizardOpen}
                          isPending={insuranceAgreements.addAgreement.isPending}
                          onClose={() => setInsuranceWizardOpen(false)}
                          onCreate={async (payload) => {
                            const agreement = await insuranceAgreements.addAgreement.mutateAsync(payload);
                            form.setValue("insurance_agreement_id", agreement.id, { shouldDirty: true, shouldValidate: true });
                            return agreement;
                          }}
                        />
                      </>
                    ) : null}

                    {financialPlan === "exempt" ? (
                      <div className="rounded-md border border-border bg-muted/30 px-3 py-3 text-sm text-foreground sm:col-span-2">
                        Paciente marcado como isento. Nenhum valor financeiro inicial será exigido.
                      </div>
                    ) : null}
                  </Section>

                  <Section title="Endereço" description="Endereço estruturado para documentos, cobranças e cadastro clínico.">
                    {renderSelectField("country", "País", [{ value: "Brasil", label: "Brasil" }], "Brasil")}
                    <FormField
                      control={form.control}
                      name="postal_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClassName}>CEP</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={(field.value as string) || ""}
                              onChange={(event) => {
                                field.onChange(formatCepInput(event.target.value));
                                setSelectedAddressQuery("");
                                setAutoAppliedCep("");
                              }}
                              placeholder="00000-000"
                              inputMode="numeric"
                              className={inputClassName}
                            />
                          </FormControl>
                          {addressLoading || addressValidating || addressError ? (
                            <FormDescription className="text-xs">
                              {addressLoading || addressValidating
                                ? "Buscando endereco pelo CEP..."
                                : addressError}
                            </FormDescription>
                          ) : null}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {renderTextField("city", "Cidade", { placeholder: "Digite aqui" })}
                    {renderSelectField("state", "Estado", STATE_OPTIONS.map((state) => ({ value: state, label: state })), "UF", undefined, undefined, true)}
                    {renderTextField("street", "Endereço", { placeholder: "Rua, avenida..." }, "sm:col-span-2")}
                    {renderTextField("street_number", "Número", { placeholder: "Digite aqui" })}
                    {renderTextField("neighborhood", "Bairro", { placeholder: "Digite aqui" })}
                    {renderTextField("complement", "Complemento", { placeholder: "Digite aqui" }, "sm:col-span-2")}
                  </Section>

                  <Section title="Dados adicionais" description="Informações complementares para contato e classificação cadastral.">
                    {renderTextField("naturality", "Naturalidade", { placeholder: "Digite aqui" })}
                    {renderSelectField("education_level", "Escolaridade", EDUCATION_OPTIONS.map((item) => ({ value: item, label: item })), "Selecione", undefined, undefined, true)}
                    {renderSelectField("race", "Raça", RACE_OPTIONS.map((item) => ({ value: item, label: item })), "Selecione", undefined, undefined, true)}
                    {renderTextField("profession", "Profissão", { placeholder: "Digite aqui" })}
                    {renderTextField("relative_name", "Nome de um parente", { placeholder: "Digite aqui" })}
                    {renderTextField("relative_relationship", "Parentesco", { placeholder: "Digite aqui", maxLength: 50 })}
                    {renderTextField("relative_phone", "Telefone", { placeholder: "(00) 0000-0000" })}
                    <FormField
                      control={form.control}
                      name="referrer_option_id"
                      render={({ field }) => (
                        <LookupSelect
                          label="Encaminhado por"
                          value={(field.value as string) || "__none"}
                          placeholder="Selecione"
                          options={referrerOptions.data || []}
                          isAdding={referrerOptions.addOption.isPending}
                          onChange={field.onChange}
                          onAdd={(label) => referrerOptions.addOption.mutateAsync(label)}
                        />
                      )}
                    />
                  </Section>

                  <Section title="Responsável" description="Dados usados quando o responsável deve receber cobranças, documentos ou notas.">
                    {renderTextField("responsible_name", "Nome do responsável", { placeholder: "Digite aqui" })}
                    {renderTextField("responsible_email", "E-mail do responsável", { placeholder: "email@exemplo.com", type: "email" })}
                    {renderPhoneField("responsible_phone_country_code", "responsible_mobile_phone", "Celular")}
                    {renderTextField("responsible_cpf", "CPF", { placeholder: "000.000.000-00" })}
                    {renderTextField("responsible_rg", "RG", { placeholder: "Digite aqui" })}
                    {renderDateField("responsible_birth_date", "Data de nascimento")}
                    <FormField
                      control={form.control}
                      name="responsible_use_for_billing_documents"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2 xl:col-span-3">
                          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3">
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <span className="text-sm leading-relaxed text-foreground">
                              Permitir o envio de cobranças e documentos por e-mail e WhatsApp do responsável, além da emissão de notas fiscais e cobranças utilizando o nome e CPF cadastrados?
                            </span>
                          </label>
                        </FormItem>
                      )}
                    />
                  </Section>
                </>
              ) : null}
            </div>
          </div>

          <footer className="shrink-0 border-t border-border/60 bg-background/82 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-2xl sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-6xl flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" className="h-11 rounded-md px-5" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || isFormLoading} className="h-11 rounded-md px-5">
                {isPending || isFormLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isEditing ? "Salvar alteracoes" : "Salvar prontuario"}
              </Button>
            </div>
          </footer>
        </form>
      </Form>
    </TooltipProvider>
  );
};
