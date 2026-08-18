import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Mic, ShieldCheck } from "lucide-react";
import {
  SYNAPSE_OPAQUE_CONFIRM_REQUEST_EVENT,
  SYNAPSE_VOICE_REVIEW_EVENT,
  normalizeVoiceReviewAction,
  respondOpaqueConfirmation,
  type SynapseActionReview,
  type SynapseOpaqueConfirmationRequest,
  type SynapseReviewSegment,
  type SynapseVoiceReviewAction,
} from "@/lib/synapse-voice-ui-protocol";

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

const parseSpokenNumber = (value: string) => {
  const normalized = normalizeSpeech(value);
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, "");
  if (/^\d{3,4}$/.test(digits)) return Number(digits);

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
  return consumed && Number.isFinite(result) ? result : null;
};

const challengeNumber = () => {
  const array = new Uint32Array(1);
  globalThis.crypto.getRandomValues(array);
  return 100 + (array[0] % 900);
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

const segmentText = (segment: SynapseReviewSegment) => {
  if (segment.type === "text") return segment.text;
  if (segment.type === "editable") return String(segment.value ?? "");
  const selected = segment.options.find((option) => option.value === segment.value);
  return selected?.label || segment.value;
};

const ReviewOverlay = ({ review }: { review: SynapseActionReview }) => {
  const cards = review.data.actions;
  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.99 }}
      transition={{ type: "spring", stiffness: 360, damping: 32 }}
      className="pointer-events-auto fixed inset-x-0 bottom-28 z-[92] mx-auto w-[min(94vw,980px)] px-3"
      aria-label="Revisão da ação do Synapse"
      aria-live="polite"
    >
      <div className="rounded-[28px] border border-border/55 bg-background/88 p-3 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/88">
        <div className="mb-3 flex items-center justify-between gap-3 px-2 pt-1">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Revisão antes de confirmar</p>
            <p className="mt-1 text-sm text-foreground/88">Confira o que será executado. Diga “confirmo ação” quando estiver correto.</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {cards.length} {cards.length === 1 ? "etapa" : "etapas"}
          </div>
        </div>

        <div className="relative overflow-x-auto pb-1 [scrollbar-width:thin]">
          <div className="flex min-w-max items-stretch gap-2.5">
            {cards.map((card, index) => (
              <motion.article
                key={card.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.2) }}
                className="relative w-[248px] shrink-0 overflow-hidden rounded-[22px] border border-border/55 bg-card/86 p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                    {index + 1}
                  </span>
                  <Check className="h-4 w-4 text-muted-foreground/55" aria-hidden="true" />
                </div>
                <h3 className="text-center text-xs font-semibold tracking-wide text-foreground">{card.area}</h3>
                <p className="mt-2 text-center text-sm leading-5 text-muted-foreground">
                  {card.segments.map(segmentText).join("").replace(/\s+/g, " ").trim()}
                </p>
                <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/18 to-transparent" />
              </motion.article>
            ))}
          </div>
        </div>

        <p className="mt-2 px-2 text-[11px] leading-4 text-muted-foreground/80">
          Edição de campos só será habilitada quando a versão visível puder atualizar o plano executável com hash novo. Até lá, a revisão é somente leitura para evitar confirmar dados diferentes dos que serão executados.
        </p>
      </div>
    </motion.section>
  );
};

const OpaqueConfirmationOverlay = ({
  request,
  onFinish,
}: {
  request: SynapseOpaqueConfirmationRequest;
  onFinish: () => void;
}) => {
  const code = useMemo(challengeNumber, [request.requestId]);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [listening, setListening] = useState(false);

  const finish = useCallback((success: boolean, cancelled = false, message = "") => {
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    respondOpaqueConfirmation({
      requestId: request.requestId,
      success,
      cancelled,
      message,
    });
    onFinish();
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

  useEffect(() => {
    const timer = window.setTimeout(startRecognition, 180);
    return () => {
      window.clearTimeout(timer);
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
    };
  }, [startRecognition]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      finish(false, true, "Confirmação cancelada no navegador.");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finish]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/38 px-5 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="synapse-opaque-confirm-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.965 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.985 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        className="w-[min(92vw,430px)] rounded-[32px] border border-white/20 bg-background/94 px-7 py-8 text-center shadow-2xl dark:border-white/10 dark:bg-zinc-950/94"
      >
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-muted/50">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 id="synapse-opaque-confirm-title" className="text-base font-semibold text-foreground">Confirmação protegida</h2>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">Repita o número no centro da sua tela.</p>

        <div className="my-7 select-none font-mono text-6xl font-semibold tracking-[0.14em] text-foreground" aria-label={`Número de confirmação ${code}`}>
          {code}
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={startRecognition}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-muted-foreground outline-none transition hover:bg-muted/55 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Mic className={`h-4 w-4 ${listening ? "animate-pulse motion-reduce:animate-none" : ""}`} aria-hidden="true" />
            Microfone falhou?
          </button>
          <button
            type="button"
            onClick={() => finish(true, false, "Confirmação concluída por clique local no navegador.")}
            className="min-h-11 rounded-full border border-border/65 bg-foreground px-5 text-sm font-semibold text-background shadow-sm outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Confirme clicando aqui
          </button>
        </div>

        {attempts > 0 && attempts < 3 ? (
          <p className="mt-4 text-xs text-muted-foreground" role="status" aria-live="polite">
            O número ouvido não correspondeu. Tentativa {attempts} de 3.
          </p>
        ) : null}
      </motion.div>
    </motion.div>
  );
};

export const SynapseVoiceActionOverlays = () => {
  const [review, setReview] = useState<SynapseActionReview | null>(null);
  const [confirmation, setConfirmation] = useState<SynapseOpaqueConfirmationRequest | null>(null);

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
      setConfirmation({
        requestId: String(detail.requestId).slice(0, 160),
        challengeId: String(detail.challengeId).slice(0, 160),
      });
    };

    window.addEventListener(SYNAPSE_VOICE_REVIEW_EVENT, onReview as EventListener);
    window.addEventListener(SYNAPSE_OPAQUE_CONFIRM_REQUEST_EVENT, onConfirmation as EventListener);
    return () => {
      window.removeEventListener(SYNAPSE_VOICE_REVIEW_EVENT, onReview as EventListener);
      window.removeEventListener(SYNAPSE_OPAQUE_CONFIRM_REQUEST_EVENT, onConfirmation as EventListener);
    };
  }, []);

  return (
    <AnimatePresence>
      {review && !confirmation ? <ReviewOverlay key={review.data.reviewId} review={review} /> : null}
      {confirmation ? (
        <OpaqueConfirmationOverlay
          key={confirmation.requestId}
          request={confirmation}
          onFinish={() => setConfirmation(null)}
        />
      ) : null}
    </AnimatePresence>
  );
};
