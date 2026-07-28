import { ExternalLink, Instagram } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { NEURALCAST_REELS } from "../content";
import { triggerNeuralCastTactileFeedback } from "../utils/tactile";
import { cn } from "@/lib/utils";

function ReelPhone({ index, compact = false }: { index: number; compact?: boolean }) {
  const reel = NEURALCAST_REELS[index];
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.article
      initial={shouldReduceMotion ? false : { opacity: 0, y: 28, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={shouldReduceMotion ? undefined : { duration: 0.6, delay: index * 0.08 }}
      className={cn("snap-center", compact ? "w-[84vw] max-w-[330px] shrink-0" : "w-[320px] shrink-0 md:w-[350px]")}
    >
      <motion.div
        animate={shouldReduceMotion ? undefined : { y: [0, -8, 0] }}
        transition={shouldReduceMotion ? undefined : { duration: 5.2 + index * 0.3, repeat: Infinity, ease: "easeInOut", delay: index * 0.18 }}
        className="relative rounded-[3.2rem] border border-white/[0.14] bg-[#080808] p-[10px] shadow-[0_34px_90px_rgba(0,0,0,0.35)]"
      >
        <div className="pointer-events-none absolute left-1/2 top-[17px] z-20 h-7 w-[92px] -translate-x-1/2 rounded-full bg-black shadow-[0_1px_0_rgba(255,255,255,0.12)]" />
        <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.65rem] bg-white">
          <iframe
            src={reel.embedUrl}
            title={reel.title}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0 bg-white"
          />
        </div>
        <div className="pointer-events-none absolute bottom-[15px] left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-white/65" />
      </motion.div>
      <div className="mt-6 flex items-start justify-between gap-4 px-2 text-[#f4e8d1]">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#d5ad69]">Reel NeuralCast</p>
          <h3 className="mt-2 text-lg font-black leading-tight tracking-[-0.035em]">{reel.title}</h3>
        </div>
        <a
          href={reel.permalink}
          target="_blank"
          rel="noreferrer"
          aria-label={`Abrir ${reel.title} no Instagram`}
          className="neuralcast-tactile grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#f4e8d1]/[0.20] text-[#f4e8d1] transition-colors hover:bg-[#f4e8d1] hover:text-[#17130f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d5ad69]/55"
          onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </motion.article>
  );
}

export function NeuralCastReelsSection({ mobile = false }: { mobile?: boolean }) {
  return (
    <section id="reels" className="neuralcast-dark-section relative overflow-hidden bg-[#17130f] px-0 py-24 text-[#f4e8d1] md:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(169,120,56,0.28),transparent_34%),radial-gradient(circle_at_95%_70%,rgba(234,216,183,0.12),transparent_30%)]" />
      <div className="relative mx-auto max-w-[1480px] px-5 md:px-8">
        <div className={cn("grid gap-8", mobile ? "" : "lg:grid-cols-[0.78fr_1.22fr] lg:items-end")}>
          <div>
            <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#d5ad69]">
              <Instagram className="h-4 w-4" /> Publicações recentes
            </p>
            <h2 className={cn("mt-6 max-w-[12ch] text-balance font-black leading-[0.88] tracking-[-0.07em]", mobile ? "text-5xl" : "text-5xl md:text-7xl")}>
              Ideias que também ganham voz e movimento.
            </h2>
          </div>
          <p className="max-w-2xl text-base font-medium leading-relaxed text-[#f4e8d1]/[0.62] md:text-lg">
            Assista aos reels mais recentes da NeuralCast sobre neurociência organizacional, relações humanas, liderança e desenvolvimento de pessoas.
          </p>
        </div>
      </div>

      <div className="relative mt-14 overflow-x-auto px-5 pb-8 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mt-20 md:px-8">
        <div className="mx-auto flex w-max snap-x snap-mandatory gap-7 pr-5 md:gap-9 md:pr-8">
          {NEURALCAST_REELS.map((_, index) => <ReelPhone key={index} index={index} compact={mobile} />)}
        </div>
      </div>
    </section>
  );
}
