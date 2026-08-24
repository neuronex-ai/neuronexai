import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Mic, ShieldCheck } from "lucide-react";
import {
  SYNAPSE_ACTION_GROUP_EDIT_RESULT_EVENT,
  SYNAPSE_OPAQUE_CONFIRM_REQUEST_EVENT,
  SYNAPSE_VOICE_REVIEW_EVENT,
  emitActionGroupEditRequest,
  getPendingOpaqueConfirmationRequest,
  normalizeVoiceReviewAction,
  respondOpaqueConfirmation,
  setOpaqueCaptureBlocked,
  type SynapseActionGroupEditResult,
  type SynapseActionReview,
  type SynapseOpaqueConfirmationRequest,
  type SynapseReviewEditableSegment,
  type SynapseReviewSelectSegment,
  type SynapseReviewSegment,
  type SynapseVoiceReviewAction,
} from "@/lib/synapse-voice-ui-protocol";
import { getSynapseReviewFieldPresentation } from "@/lib/synapse-review-field-presentation";

const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezassete: 17,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  trezentos: 300,
  quatrocentos: 400,
  quinhentos: 500,
  seiscentos: 600,
  setecentos: 700,
  oitocentos: 800,
  novecentos: 900,
};

const normalizeSpeech = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const validChallengeNumber = (value: number) => Number.isInteger(value) && value >= 1 && value <= 999;

const parseSpokenNumber = (value: string) => {
  const normalized = normalizeSpeech(value);
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, "");
  if (/^\d{1,3}$/.test(digits)) {
    const numeric = Number(digits);
    return validChallengeNumber(numeric) ? numeric : null;
  }

  const tokens = normalized.split(/[\s-]+/).filter((token) => token && token !== "e");
  if (!tokens.length) return null;

  let total = 0;
  let current = 0;
  let consumed = false;
  for (const token of tokens) {
    if (token === "mil") {
      total += (current || 1) * 1000;
      current = 0;
      consumed = true;
      continue;
    }
    const numeric = WORD_NUMBERS[token];
    if (numeric === undefined) continue;
    current += numeric;
    consumed = true;
  }
  const result = total + current;
  return consumed && validChallengeNumber(result) ? result : null;
};

const challengeNumber = () => {
  const array = new Uint32Array(1);
  globalThis.crypto.getRandomValues(array);
  return 1 + (array[0] % 999);
};

type RecognitionResultEvent = {
  results: ArrayLike<{ 0?: { transcript?: string }; length: number }>;
};

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type RecognitionConstructor = new () => RecognitionLike;

const recognitionConstructor = (): RecognitionConstructor | null => {
  if (typeof window === "undefined") return null;
  const scoped = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scoped.SpeechRecognition || scoped.webkitSpeechRecognition || null;
};

const fieldKey = (stepId: string, fieldId: string) => `${stepId}:${fieldId}`;

const displayText = (segment: SynapseReviewSegment) => {
  if (segment.type === "text") return segment.text;
  if (segment.type === "editable") return String(segment.value ?? "");
  const selected = segment.options.find((option) => option.value === segment.value);
  return selected?.label || segment.value;
};

const ReviewOverlay = ({ review }: { review: SynapseActionReview }) => {
  const cards = review.data.actions;
  const reduceMotion = useReducedMotion();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rewriting, setRewriting] = useState<string | null>(null);
  const [editFeedback, setEditFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const versioned = Boolean(review.data.planId && review.data.planVersion && review.data.planHash);
  const confirmationLabel = review.data.confirmationPolicy === "opaque"
    ? "Confirmação protegida"
    : review.data.confirmationPolicy === "voice"
      ? "Confirmação por voz"
      : "Revisão segura";

  useEffect(() => {
    const onEditResult = (event: Event) => {
      const detail = (event as CustomEvent<SynapseActionGroupEditResult>).detail;
      if (!detail || detail.reviewId !== review.data.reviewId) return;
      const key = fieldKey(detail.stepId, detail.fieldId);
      setRewriting((current) => current === key ? null : current);
      setEditFeedback({
        kind: detail.success ? "success" : "error",
        message: detail.message || (detail.success ? "Campo atualizado." : "Não consegui atualizar este campo."),
      });
    };
    window.addEventListener(SYNAPSE_ACTION_GROUP_EDIT_RESULT_EVENT, onEditResult as EventListener);
    return () => window.removeEventListener(SYNAPSE_ACTION_GROUP_EDIT_RESULT_EVENT, onEditResult as EventListener);
  }, [review.data.reviewId]);

  const requestEdit = useCallback((stepId: string, fieldId: string, value: unknown) => {
    if (!review.data.planId || !review.data.planVersion || !review.data.planHash) return false;
    setEditFeedback(null);
    const emitted = emitActionGroupEditRequest({
      reviewId: review.data.reviewId,
      planId: review.data.planId,
      planVersion: review.data.planVersion,
      planHash: review.data.planHash,
      stepId,
      fieldId,
      value,
    });
    if (emitted) setRewriting(fieldKey(stepId, fieldId));
    return emitted;
  }, [review]);

  const editableField = (
    stepId: string,
    segment: SynapseReviewEditableSegment,
  ) => {
    const key = fieldKey(stepId, segment.fieldId);
    const presentation = getSynapseReviewFieldPresentation(segment.fieldId, segment.label, segment.value);
    const original = presentation.editValue;
    const value = drafts[key] ?? original;
    const submitEdit = () => {
      if (value !== original) {
        requestEdit(stepId, segment.fieldId, presentation.formatForRequest(value));
      }
    };
    return (
      <label key={key} className="inline-flex max-w-full flex-col gap-1.5 align-middle">
        <span className="px-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
          {segment.label}
        </span>
        <input
          type={presentation.inputType}
          value={value}
          inputMode={presentation.inputType === "text"
            ? (segment.inputMode as React.HTMLAttributes<HTMLInputElement>["inputMode"]) || undefined
            : undefined}
          maxLength={presentation.inputType === "text" ? segment.maxLength : undefined}
          disabled={!versioned || rewriting === key}
          onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
          onBlur={submitEdit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitEdit();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setDrafts((current) => ({ ...current, [key]: original }));
              event.currentTarget.blur();
            }
          }}
          aria-label={segment.label}
          className="min-h-11 min-w-[104px] max-w-[226px] rounded-[13px] border border-black/[0.08] bg-white/80 px-3 py-1.5 text-center text-xs font-medium text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] outline-none transition-[border-color,box-shadow,background-color,opacity] duration-150 focus-visible:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring/45 disabled:cursor-wait disabled:opacity-60 dark:border-white/[0.09] dark:bg-white/[0.075] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        />
      </label>
    );
  };

  const selectField = (stepId: string, segment: SynapseReviewSelectSegment) => {
    const key = fieldKey(stepId, segment.fieldId);
    return (
      <label key={key} className="inline-flex max-w-full flex-col gap-1.5 align-middle">
        <span className="px-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
          {segment.label}
        </span>
        <select
          value={segment.value}
          disabled={!versioned || rewriting === key}
          onChange={(event) => requestEdit(stepId, segment.fieldId, event.target.value)}
          aria-label={segment.label}
          className="min-h-11 min-w-[112px] max-w-[214px] rounded-[13px] border border-black/[0.08] bg-white/80 px-3 py-1.5 text-center text-xs font-medium text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] outline-none transition-[border-color,box-shadow,background-color,opacity] duration-150 focus-visible:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring/45 disabled:cursor-wait disabled:opacity-60 dark:border-white/[0.09] dark:bg-white/[0.075] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        >
          {segment.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    );
  };

  return (
    <motion.section
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: "calc(-100vw - 48px)", scale: 0.985 }}
      transition={reduceMotion
        ? { duration: 0.14 }
        : { type: "spring", stiffness: 330, damping: 34, mass: 0.86 }}
      className="pointer-events-none fixed inset-0 z-[118] flex items-end justify-center px-4 pb-28"
      role="dialog"
      aria-modal="true"
      aria-label="Revisão da ação do Synapse"
      aria-live="polite"
    >
      <div className="pointer-events-auto relative w-[min(95vw,1120px)] overflow-hidden rounded-[30px] border border-black/[0.09] bg-white/[0.92] p-[18px] shadow-[0_30px_92px_-34px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-[42px] backdrop-saturate-150 dark:border-white/[0.11] dark:bg-[#09090b]/[0.93] dark:shadow-[0_34px_100px_-36px_rgba(0,0,0,0.82),inset_0_1px_0_rgba(255,255,255,0.09)]">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/20" />
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-5 gap-y-3 px-1 pt-0.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Revisar antes de executar</p>
              {versioned ? (
                <span className="rounded-full bg-muted/65 px-2 py-1 text-[10px] font-medium text-muted-foreground">v{review.data.planVersion}</span>
              ) : null}
            </div>
            <p className="mt-1 max-w-[720px] text-sm leading-5 text-foreground/88">
              Confira os detalhes. Edite o que precisar e, quando estiver certo, diga “confirmo ação”.
            </p>
            {editFeedback ? (
              <p
                className={`mt-1.5 text-xs ${editFeedback.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}
                role="status"
                aria-live="polite"
              >
                {editFeedback.message}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex min-h-9 items-center gap-1.5 rounded-full border border-border/55 bg-muted/45 px-3 text-[11px] font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {confirmationLabel}
            </div>
            <div className="flex min-h-9 items-center rounded-full border border-border/55 bg-background/72 px-3 text-[11px] font-medium text-muted-foreground">
              {cards.length} {cards.length === 1 ? "etapa" : "etapas"}
            </div>
          </div>
        </div>

        <div className="relative overflow-x-auto overscroll-x-contain pb-1.5 [scrollbar-width:thin] snap-x snap-proximity scroll-px-1" tabIndex={0} aria-label="Etapas da revisão">
          <div className="flex min-w-max items-stretch gap-3">
            {cards.map((card, index) => (
              <motion.article
                key={card.id}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: reduceMotion ? 0.12 : 0.18, delay: reduceMotion ? 0 : Math.min(index * 0.035, 0.16) }}
                className="relative w-[276px] shrink-0 snap-start overflow-hidden rounded-[22px] border border-black/[0.075] bg-white/[0.76] p-[18px] shadow-[0_12px_28px_-22px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.86)] backdrop-blur-2xl dark:border-white/[0.085] dark:bg-white/[0.052] dark:shadow-[0_14px_32px_-22px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.07)]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold tabular-nums text-background" aria-label={`Etapa ${index + 1}`}>
                    {index + 1}
                  </span>
                  {rewriting?.startsWith(`${card.id}:`) ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground" role="status">
                      <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      atualizando
                    </span>
                  ) : (
                    <Check className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
                  )}
                </div>
                <h3 className="text-left text-xs font-semibold tracking-wide text-foreground">{card.area}</h3>
                <div className="mt-2.5 flex min-h-14 flex-wrap items-end justify-start gap-x-2 gap-y-2.5 text-left text-sm leading-5 text-muted-foreground">
                  {card.segments.map((segment, segmentIndex) => {
                    if (segment.type === "editable") return editableField(card.id, segment);
                    if (segment.type === "select") return selectField(card.id, segment);
                    return <span key={`${card.id}:text:${segmentIndex}`}>{displayText(segment)}</span>;
                  })}
                </div>
                <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/16 to-transparent" />
              </motion.article>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-1 text-[11px] leading-4 text-muted-foreground/80">
          <p>
            {versioned
              ? "Cada edição gera uma nova versão segura antes da confirmação."
              : "Somente leitura: esta revisão não recebeu identidade/versionamento seguro do plano."}
          </p>
          {versioned ? <p className="font-medium text-foreground/65">Enter salva · Esc desfaz o campo</p> : null}
        </div>
      </div>
    </motion.section>
  );
};

const OpaqueConfirmationOverlay = ({
  request,
  onFinish,
}: {
  request: SynapseOpaqueConfirmationRequest;
  onFinish: (confirmed: boolean) => void;
}) => {
  const code = useMemo(challengeNumber, [request.requestId]);
  const reduceMotion = useReducedMotion();
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [listening, setListening] = useState(false);
  const [typedCode, setTypedCode] = useState("");
  const [recognitionAvailable] = useState(() => Boolean(recognitionConstructor()));

  useEffect(() => {
    setOpaqueCaptureBlocked(true);
    return () => setOpaqueCaptureBlocked(false);
  }, [request.requestId]);

  const finish = useCallback((success: boolean, cancelled = false, message = "") => {
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    setOpaqueCaptureBlocked(false);
    respondOpaqueConfirmation({
      requestId: request.requestId,
      success,
      cancelled,
      message,
    });
    onFinish(success);
  }, [onFinish, request.requestId]);

  const rejectAttempt = useCallback(() => {
    setAttempts((current) => {
      const next = current + 1;
      if (next >= 3) {
        window.setTimeout(() => finish(false, true, "Três tentativas não corresponderam ao desafio. Volte à revisão antes de executar."), 0);
      }
      return next;
    });
  }, [finish]);

  const startRecognition = useCallback(() => {
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setListening(false);
      return;
    }
    recognitionRef.current?.abort?.();
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.onresult = (event) => {
      setListening(false);
      const candidates: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const transcript = event.results[i]?.[0]?.transcript;
        if (transcript) candidates.push(transcript);
      }
      const matched = candidates.some((candidate) => parseSpokenNumber(candidate) === code);
      if (matched) {
        finish(true, false, "Número confirmado localmente no navegador.");
      } else {
        rejectAttempt();
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [code, finish, rejectAttempt]);

  const confirmTypedCode = useCallback(() => {
    const numeric = Number(typedCode.replace(/\D/g, ""));
    if (validChallengeNumber(numeric) && numeric === code) {
      finish(true, false, "Número confirmado localmente no navegador.");
      return;
    }
    setTypedCode("");
    rejectAttempt();
  }, [code, finish, rejectAttempt, typedCode]);

  useEffect(() => {
    if (!recognitionAvailable) return undefined;
    const timer = window.setTimeout(startRecognition, reduceMotion ? 60 : 180);
    return () => {
      window.clearTimeout(timer);
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
    };
  }, [recognitionAvailable, reduceMotion, startRecognition]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish(false, true, "Confirmação cancelada no navegador.");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finish]);

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: "calc(100vw + 48px)" }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: "calc(100vw + 48px)" }}
      transition={reduceMotion
        ? { duration: 0.14 }
        : { type: "spring", stiffness: 330, damping: 34, mass: 0.86 }}
      className="fixed inset-0 z-[120] flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="synapse-opaque-confirm-title"
      aria-describedby="synapse-opaque-confirm-description"
    >
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.99 }}
        transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
        className="relative w-[min(92vw,460px)] overflow-hidden rounded-[32px] border border-black/[0.09] bg-white/[0.94] px-8 py-9 text-center shadow-[0_34px_104px_-34px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-[42px] backdrop-saturate-150 dark:border-white/[0.11] dark:bg-[#09090b]/[0.95] dark:shadow-[0_38px_112px_-34px_rgba(0,0,0,0.86),inset_0_1px_0_rgba(255,255,255,0.09)]"
      >
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/20" />
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-muted/50">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 id="synapse-opaque-confirm-title" className="text-base font-semibold text-foreground">Confirmação protegida</h2>
        <p id="synapse-opaque-confirm-description" className="mt-2 text-sm leading-5 text-muted-foreground">
          Repita o número abaixo. O microfone principal do Synapse fica pausado durante esta etapa.
        </p>

        <div className="my-7 select-none font-mono text-6xl font-semibold tabular-nums tracking-[0.12em] text-foreground" aria-label={`Número de confirmação ${code}`}>
          {code}
        </div>

        {attempts > 0 && attempts < 3 ? (
          <p className="mb-3 text-xs text-destructive" role="status" aria-live="polite">
            Não correspondeu. Tentativa {attempts} de 3.
          </p>
        ) : null}

        <div className="flex flex-col items-stretch gap-2.5">
          {recognitionAvailable ? (
            <button
              type="button"
              onClick={startRecognition}
              disabled={listening}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/60 bg-muted/45 px-4 text-sm font-medium text-foreground outline-none transition-[background-color,opacity,transform,box-shadow] duration-150 hover:bg-muted/70 active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-65 motion-reduce:transform-none"
            >
              <Mic className={`h-4 w-4 ${listening ? "animate-pulse motion-reduce:animate-none" : ""}`} aria-hidden="true" />
              {listening ? "Ouvindo…" : "Ouvir novamente"}
            </button>
          ) : null}

          <div className="mt-1 flex items-center gap-2" aria-label="Confirmar digitando o código">
            <input
              value={typedCode}
              onChange={(event) => setTypedCode(event.target.value.replace(/\D/g, "").slice(0, 3))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && typedCode.length >= 1) confirmTypedCode();
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={3}
              placeholder="Digite o número"
              aria-label="Digite o número de confirmação"
              className="min-h-11 min-w-0 flex-1 rounded-full border border-border/65 bg-background px-4 text-center text-sm font-medium tabular-nums text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring/45"
            />
            <button
              type="button"
              onClick={confirmTypedCode}
              disabled={typedCode.length < 1}
              className="min-h-11 shrink-0 rounded-full bg-foreground px-5 text-sm font-semibold text-background shadow-sm outline-none transition-[opacity,transform,box-shadow] duration-150 hover:opacity-90 active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transform-none"
            >
              Confirmar
            </button>
          </div>

          <button
            type="button"
            onClick={() => finish(false, true, "Confirmação cancelada no navegador.")}
            className="min-h-11 rounded-full px-4 text-sm font-medium text-muted-foreground outline-none transition-[background-color,color,transform] duration-150 hover:bg-muted/50 hover:text-foreground active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-ring/45 motion-reduce:transform-none"
          >
            Cancelar e voltar à revisão
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const SynapseVoiceActionOverlays = () => {
  const [review, setReview] = useState<SynapseActionReview | null>(null);
  const [confirmation, setConfirmation] = useState<SynapseOpaqueConfirmationRequest | null>(
    () => getPendingOpaqueConfirmationRequest(),
  );

  useEffect(() => {
    const onReview = (event: Event) => {
      const raw = (event as CustomEvent<SynapseVoiceReviewAction>).detail;
      const action = normalizeVoiceReviewAction(raw);
      if (!action) return;
      if (action.type === "synapse_action_review_dismiss") {
        setReview(null);
        return;
      }
      setReview(action);
    };
    const onConfirmation = (event: Event) => {
      const detail = (event as CustomEvent<SynapseOpaqueConfirmationRequest>).detail;
      if (!detail?.requestId || !detail?.challengeId) return;
      setOpaqueCaptureBlocked(true);
      setConfirmation({
        requestId: String(detail.requestId).slice(0, 160),
        challengeId: String(detail.challengeId).slice(0, 160),
      });
    };

    window.addEventListener(SYNAPSE_VOICE_REVIEW_EVENT, onReview as EventListener);
    window.addEventListener(SYNAPSE_OPAQUE_CONFIRM_REQUEST_EVENT, onConfirmation as EventListener);
    const pendingConfirmation = getPendingOpaqueConfirmationRequest();
    if (pendingConfirmation) onConfirmation(new CustomEvent(SYNAPSE_OPAQUE_CONFIRM_REQUEST_EVENT, {
      detail: pendingConfirmation,
    }));
    return () => {
      window.removeEventListener(SYNAPSE_VOICE_REVIEW_EVENT, onReview as EventListener);
      window.removeEventListener(SYNAPSE_OPAQUE_CONFIRM_REQUEST_EVENT, onConfirmation as EventListener);
      setOpaqueCaptureBlocked(false);
    };
  }, []);

  const overlayVisible = Boolean(review || confirmation);

  return (
    <>
      <AnimatePresence>
        {overlayVisible ? (
          <motion.div
            key="synapse-action-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none fixed inset-0 z-[116] bg-white/20 backdrop-blur-[3px] dark:bg-black/30"
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        {confirmation ? (
          <OpaqueConfirmationOverlay
            key={`confirmation:${confirmation.requestId}`}
            request={confirmation}
            onFinish={(confirmed) => {
              setConfirmation(null);
              if (confirmed) setReview(null);
            }}
          />
        ) : review ? (
          <ReviewOverlay key={`review:${review.data.reviewId}`} review={review} />
        ) : null}
      </AnimatePresence>
    </>
  );
};
