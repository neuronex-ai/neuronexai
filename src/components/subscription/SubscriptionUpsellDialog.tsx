import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AppModalShell, ModalHeroIcon } from "@/components/ui/app-modal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import type { BillingAddressPayload } from "@/lib/subscription-checkout";
import { isValidBillingAddress, normalizePostalCode } from "@/lib/subscription-checkout";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Home,
  Loader2,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type SubscriptionUpsellDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow: string;
  title: string;
  description: string;
  featureName?: string;
  planName?: string;
  planDescription?: string;
  priceLabel: string;
  features: string[];
  cpfCnpj: string;
  onCpfCnpjChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  billingAddress: BillingAddressPayload;
  onBillingAddressChange: (patch: Partial<BillingAddressPayload>) => void;
  checkoutUrl?: string;
  checkoutLoading?: boolean;
  freeLoading?: boolean;
  canContinueFree?: boolean;
  onCheckout: () => void;
  onContinueFree?: () => void;
};

const TOTAL_STEPS = 3;

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const formatCpfCnpj = (value: string) => {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
};

const normalizeBrazilianPhone = (value: string) => {
  const digits = onlyDigits(value);
  const trimmed = value.trim();
  const hasCountryPrefix = trimmed.startsWith("+55") || /^55(?:\D|$)/.test(trimmed);
  const localDigits = hasCountryPrefix || (digits.startsWith("55") && digits.length > 11)
    ? digits.slice(2)
    : digits;

  return localDigits.slice(0, 11);
};

const formatBrazilianPhone = (value: string) => {
  const local = normalizeBrazilianPhone(value).slice(0, 11);
  if (!local) return "+55 ";

  if (local.length <= 10) {
    return `+55 ${local}`
      .replace(/^\+55 (\d{2})(\d)/, "+55 ($1) $2")
      .replace(/^\+55 \((\d{2})\) (\d{4})(\d)/, "+55 ($1) $2-$3");
  }

  return `+55 ${local}`
    .replace(/^\+55 (\d{2})(\d)/, "+55 ($1) $2")
    .replace(/^\+55 \((\d{2})\) (\d{5})(\d)/, "+55 ($1) $2-$3");
};

const formatCep = (value: string) => {
  const digits = normalizePostalCode(value);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
};

const isValidCpfCnpj = (value: string) => {
  const digits = onlyDigits(value);
  return (digits.length === 11 || digits.length === 14) && !/^0+$/.test(digits);
};

const isValidPhone = (value: string) => {
  const digits = normalizeBrazilianPhone(value);
  return (digits.length === 10 || digits.length === 11) && !/^0+$/.test(digits);
};

const splitPriceLabel = (value: string) => {
  const [price, period] = value.split("/");
  return {
    price: price?.trim() || value,
    period: period ? `/${period.trim()}` : "/mês",
  };
};

const StepBars = ({ step }: { step: number }) => (
  <div className="mt-4 flex items-center justify-center gap-2" aria-label={`Etapa ${step} de ${TOTAL_STEPS}`}>
    {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
      <span
        key={index}
        className={cn(
          "h-1.5 rounded-full transition-all duration-200",
          index + 1 <= step ? "w-10 bg-foreground" : "w-7 bg-foreground/18",
        )}
      />
    ))}
  </div>
);

const FieldError = ({ show, children }: { show: boolean; children: string }) => (
  <p className={cn("min-h-[1rem] px-1 text-[11px] font-semibold text-destructive", !show && "invisible")}>
    {children}
  </p>
);

const iconSurfaceClass =
  "border-zinc-200 bg-zinc-50 text-zinc-700 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.045] dark:text-white/70";
const cardSurfaceClass =
  "border-zinc-200 bg-white text-zinc-950 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.45)] dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white dark:shadow-none";
const subtleSurfaceClass =
  "border-zinc-200 bg-zinc-50/80 text-zinc-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70";
const inputSurfaceClass =
  "h-12 rounded-2xl border-zinc-200 bg-white px-4 font-semibold text-zinc-950 shadow-inner placeholder:text-zinc-400 focus-visible:ring-1 focus-visible:ring-zinc-950/20 dark:border-white/[0.08] dark:bg-white/[0.045] dark:text-white dark:placeholder:text-white/30 dark:focus-visible:ring-white/20";
const readonlyInputSurfaceClass =
  "h-12 rounded-2xl border-zinc-200 bg-zinc-100/80 px-4 font-semibold text-zinc-500 shadow-inner focus-visible:ring-0 dark:border-white/[0.08] dark:bg-white/[0.025] dark:text-white/45";

export const SubscriptionUpsellDialog = ({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  featureName,
  planName = "Professional",
  planDescription = "Para consultórios em crescimento",
  priceLabel,
  features,
  cpfCnpj,
  onCpfCnpjChange,
  phone,
  onPhoneChange,
  billingAddress,
  onBillingAddressChange,
  checkoutUrl,
  checkoutLoading = false,
  freeLoading = false,
  canContinueFree = false,
  onCheckout,
  onContinueFree,
}: SubscriptionUpsellDialogProps) => {
  const isMobile = useIsMobile();
  const shouldReduceMotion = useReducedMotion();
  const [step, setStep] = useState(1);
  const [stepDirection, setStepDirection] = useState(1);
  const [detailsTouched, setDetailsTouched] = useState(false);
  const [autoAppliedCep, setAutoAppliedCep] = useState("");
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const price = splitPriceLabel(priceLabel);

  useEffect(() => {
    if (open) {
      setStep(1);
      setStepDirection(1);
      setDetailsTouched(false);
      setAutoAppliedCep("");
    }
  }, [open]);

  const cepDigits = normalizePostalCode(billingAddress.postalCode || "");

  useEffect(() => {
    if (!open || step !== 2 || cepDigits.length !== 8 || autoAppliedCep === cepDigits) return;

    let cancelled = false;
    setAddressLookupLoading(true);
    fetch(`https://viacep.com.br/ws/${cepDigits}/json/`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || data?.erro) return;
        onBillingAddressChange({
          postalCode: formatCep(data.cep || cepDigits),
          address: data.logradouro || billingAddress.address || "",
          province: data.bairro || billingAddress.province || "",
          city: data.localidade || billingAddress.city || "",
          state: String(data.uf || billingAddress.state || "").toUpperCase().slice(0, 2),
        });
        setAutoAppliedCep(cepDigits);
      })
      .catch(() => {
        setAutoAppliedCep(cepDigits);
      })
      .finally(() => {
        if (!cancelled) setAddressLookupLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [autoAppliedCep, billingAddress.address, billingAddress.city, billingAddress.province, billingAddress.state, cepDigits, onBillingAddressChange, open, step]);

  const visibleFeatures = useMemo(() => features.slice(0, isMobile ? 4 : 5), [features, isMobile]);
  const cpfValid = isValidCpfCnpj(cpfCnpj);
  const phoneValid = isValidPhone(phone);
  const addressValid = isValidBillingAddress(billingAddress);
  const canProceedFromDetails = cpfValid && phoneValid && addressValid;
  const actionLabel = checkoutUrl ? "Retomar checkout" : "Ir para checkout";
  const bodyMaxWidth = isMobile ? "max-w-[25rem]" : "max-w-[32rem]";
  const effectiveDescription = featureName
    ? `${featureName} está disponível no plano ${planName}. ${description}`
    : description;

  const handleNext = () => {
    if (step === 2 && !canProceedFromDetails) {
      setDetailsTouched(true);
      return;
    }
    setStepDirection(1);
    setStep((current) => Math.min(TOTAL_STEPS, current + 1));
  };

  const handleBack = () => {
    setStepDirection(-1);
    setStep((current) => Math.max(1, current - 1));
  };

  const handleCheckout = () => {
    if (!canProceedFromDetails) {
      setDetailsTouched(true);
      setStep(2);
      return;
    }
    onCheckout();
  };

  const secondaryButton = step > 1 ? (
    <Button
      type="button"
      variant="ghost"
      onClick={handleBack}
      disabled={checkoutLoading || freeLoading}
      className="h-12 w-full rounded-2xl text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <ChevronLeft className="mr-2 h-4 w-4" />
      Voltar
    </Button>
  ) : canContinueFree && onContinueFree ? (
    <Button
      type="button"
      variant="ghost"
      onClick={onContinueFree}
      disabled={checkoutLoading || freeLoading}
      className="h-12 w-full rounded-2xl text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {freeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar no plano gratuito"}
    </Button>
  ) : (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onOpenChange(false)}
      disabled={checkoutLoading}
      className="h-12 w-full rounded-2xl text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      Continuar no plano atual
    </Button>
  );

  const primaryButton = (
    <Button
      type="button"
      onClick={step === TOTAL_STEPS ? handleCheckout : handleNext}
      disabled={checkoutLoading || freeLoading}
      className={cn(
        "h-12 w-full rounded-2xl bg-foreground text-[10px] font-black uppercase tracking-[0.16em] text-background shadow-sm transition-transform hover:bg-foreground/90 active:scale-[0.99] md:h-14 md:text-[11px]",
        step === 2 && !canProceedFromDetails && detailsTouched && "ring-2 ring-destructive/25",
      )}
    >
      {checkoutLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {step === TOTAL_STEPS ? actionLabel : "Continuar"}
          <ChevronRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );

  const planCard = (
    <div className={cn("w-full rounded-[26px] border p-5 md:p-6", cardSurfaceClass)}>
      <div className="flex items-start gap-4 text-left">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", iconSurfaceClass)}>
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-black leading-none text-foreground">{planName}</h3>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">{planDescription}</p>
        </div>
        <div className="text-right">
          <span className="rounded-full bg-foreground px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-background">
            Recomendado
          </span>
          <p className="mt-3 text-2xl font-black tracking-tight text-foreground">{price.price}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{price.period}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {visibleFeatures.map((item) => (
          <div key={item} className="flex items-center gap-3 text-left">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="text-sm font-semibold leading-snug text-muted-foreground">{item}</span>
          </div>
        ))}
      </div>

      <div className={cn("mt-6 flex w-full items-start gap-3 rounded-2xl border p-3 text-left", subtleSurfaceClass)}>
        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
          A assinatura recorrente mensal é concluída no checkout seguro da Asaas por cartão de crédito.
        </p>
      </div>
    </div>
  );

  const stepContent = (
    <div className={cn("mx-auto w-full", bodyMaxWidth)}>
      {step === 1 ? (
        <div className="space-y-5 text-center">
          {planCard}
          <p className="mx-auto max-w-[28rem] text-sm font-medium leading-relaxed text-muted-foreground">
            No próximo passo, confirme os dados mínimos exigidos pela Asaas para criar o cliente pagador na conta mestra da NeuroNex.
          </p>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5 text-center">
          <div className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-[22px] border", iconSurfaceClass)}>
            <MapPin className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight text-foreground">Dados para cobrança</h3>
            <p className="mx-auto mt-2 max-w-[28rem] text-sm font-medium leading-relaxed text-muted-foreground">
              A Asaas exige documento, telefone e endereço do cliente para abrir o checkout recorrente com segurança.
            </p>
          </div>

          <div className="grid gap-4 text-left">
            <div className="space-y-2">
              <Label htmlFor="subscription-cpf-cnpj" className="ml-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                CPF ou CNPJ
              </Label>
              <Input
                id="subscription-cpf-cnpj"
                inputMode="numeric"
                autoComplete="off"
                value={cpfCnpj}
                onChange={(event) => onCpfCnpjChange(formatCpfCnpj(event.target.value))}
                placeholder="000.000.000-00"
                className={inputSurfaceClass}
              />
              <FieldError show={detailsTouched && !cpfValid}>Informe um CPF ou CNPJ válido.</FieldError>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subscription-phone" className="ml-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                Celular ou telefone
              </Label>
              <Input
                id="subscription-phone"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => onPhoneChange(formatBrazilianPhone(event.target.value))}
                placeholder="+55 (00) 00000-0000"
                className={inputSurfaceClass}
              />
              <FieldError show={detailsTouched && !phoneValid}>Informe um telefone brasileiro válido com DDD.</FieldError>
            </div>

            <div className={cn("grid gap-4 rounded-[22px] border p-4", subtleSurfaceClass)}>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Home className="h-4 w-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.16em]">Endereço fiscal</p>
              </div>

              <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
                <div className="space-y-2">
                  <Label htmlFor="subscription-postal-code" className="ml-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    CEP
                  </Label>
                  <div className="relative">
                    <Input
                      id="subscription-postal-code"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      value={billingAddress.postalCode || ""}
                      onChange={(event) => onBillingAddressChange({ postalCode: formatCep(event.target.value) })}
                      placeholder="00000-000"
                      className={inputSurfaceClass}
                    />
                    {addressLookupLoading ? (
                      <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                  <FieldError show={detailsTouched && cepDigits.length !== 8}>Informe um CEP válido.</FieldError>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscription-address" className="ml-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Endereço
                  </Label>
                  <Input
                    id="subscription-address"
                    autoComplete="address-line1"
                    value={billingAddress.address || ""}
                    onChange={(event) => onBillingAddressChange({ address: event.target.value })}
                    placeholder="Rua, avenida ou travessa"
                    className={inputSurfaceClass}
                  />
                  <FieldError show={detailsTouched && String(billingAddress.address || "").trim().length < 3}>Informe o endereço.</FieldError>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[0.75fr_1.25fr]">
                <div className="space-y-2">
                  <Label htmlFor="subscription-address-number" className="ml-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Número
                  </Label>
                  <Input
                    id="subscription-address-number"
                    autoComplete="address-line2"
                    value={billingAddress.addressNumber || ""}
                    onChange={(event) => onBillingAddressChange({ addressNumber: event.target.value })}
                    placeholder="Número"
                    className={inputSurfaceClass}
                  />
                  <FieldError show={detailsTouched && !String(billingAddress.addressNumber || "").trim()}>Informe o número.</FieldError>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscription-province" className="ml-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Bairro
                  </Label>
                  <Input
                    id="subscription-province"
                    value={billingAddress.province || ""}
                    onChange={(event) => onBillingAddressChange({ province: event.target.value })}
                    placeholder="Bairro"
                    className={inputSurfaceClass}
                  />
                  <FieldError show={detailsTouched && String(billingAddress.province || "").trim().length < 2}>Informe o bairro.</FieldError>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_0.65fr]">
                <div className="space-y-2">
                  <Label htmlFor="subscription-complement" className="ml-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Complemento
                  </Label>
                  <Input
                    id="subscription-complement"
                    value={billingAddress.complement || ""}
                    onChange={(event) => onBillingAddressChange({ complement: event.target.value })}
                    placeholder="Sala, bloco, conjunto"
                    className={inputSurfaceClass}
                  />
                  <FieldError show={false}>Campo opcional.</FieldError>
                </div>

                <div className="space-y-2">
                  <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Cidade/UF
                  </Label>
                  <Input
                    readOnly
                    value={[billingAddress.city, billingAddress.state].filter(Boolean).join(" / ")}
                    placeholder="Preenchido pelo CEP"
                    className={readonlyInputSurfaceClass}
                  />
                  <FieldError show={false}>Campo auxiliar.</FieldError>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-5 text-center">
          <div className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-[22px] border", iconSurfaceClass)}>
            <ShieldCheck className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight text-foreground">Tudo pronto para o checkout</h3>
            <p className="mx-auto mt-2 max-w-[28rem] text-sm font-medium leading-relaxed text-muted-foreground">
              Você será redirecionado para a Asaas. O acesso pago só será liberado após confirmação confiável do pagamento.
            </p>
          </div>

          <div className="grid gap-3 text-left">
            <div className={cn("rounded-2xl border p-4", subtleSurfaceClass)}>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Plano</p>
              <p className="mt-1 text-sm font-bold text-foreground">{planName} · {priceLabel}</p>
            </div>
            <div className={cn("rounded-2xl border p-4", subtleSurfaceClass)}>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Dados validados</p>
              <p className="mt-1 text-sm font-bold text-foreground">CPF/CNPJ, telefone e endereço confirmados</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  const stepIndicator = <StepBars step={step} />;

  const stepMotion = {
    enter: (direction: number) => ({
      x: shouldReduceMotion ? 0 : direction > 0 ? 96 : -96,
      opacity: shouldReduceMotion ? 1 : 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: shouldReduceMotion ? 0 : direction > 0 ? -96 : 96,
      opacity: shouldReduceMotion ? 1 : 0,
    }),
  };

  const stepTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.26, ease: [0.22, 1, 0.36, 1] as const };

  const wizardPage = (
    <div className="w-full">
      <div className="pb-2">{stepIndicator}</div>
      <AnimatePresence initial={false} custom={stepDirection} mode="wait">
        <motion.div
          key={step}
          custom={stepDirection}
          variants={stepMotion}
          initial="enter"
          animate="center"
          exit="exit"
          transition={stepTransition}
          className="w-full"
        >
          <div className={cn("w-full py-4", isMobile ? "px-0" : "md:py-5")}>{stepContent}</div>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  const footer = (
    <div className={cn("mx-auto grid gap-3", bodyMaxWidth, isMobile ? "grid-cols-1" : "grid-cols-[1fr_1.25fr]")}>
      {secondaryButton}
      {primaryButton}
    </div>
  );

  return (
    <AppModalShell
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      eyebrow={eyebrow}
      title={title}
      description={effectiveDescription}
      heroIcon={<ModalHeroIcon icon={Lock} ariaLabel="Funcionalidade premium" />}
      footer={footer}
      bodyClassName="flex flex-col items-center"
    >
      {wizardPage}
    </AppModalShell>
  );
};
