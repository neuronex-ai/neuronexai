import { motion } from 'framer-motion';
import { Wifi, ShieldCheck, Hexagon } from 'lucide-react';
import type { KeyboardEvent } from "react";

import { useReducedMotionPreference } from "@/hooks/use-reduced-motion-preference";
import { cn } from "@/lib/utils";

interface NeuroNexCardProps {
  name: string;
  bankName?: string;
  bankCode?: string;
  agency?: string;
  account?: string;
  accountType?: string;
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
  showSensitive?: boolean;
}

const SilverChip = () => (
  <div className="w-11 h-8 rounded-[6px] relative overflow-hidden shadow-inner border border-white/20 dark:border-white/20 bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-300">
    <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 gap-[1px] opacity-40 mix-blend-multiply">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="border-[0.5px] border-black/40 rounded-[1px]" />
      ))}
    </div>
    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-black/10 pointer-events-none" />
  </div>
);

const NoiseTexture = () => (
  <svg style={{ position: 'fixed', opacity: 0, pointerEvents: 'none' }}>
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
  </svg>
);

const MatteBlackTexture = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[26px] bg-[#09090b]">
    {/* Subtle Noise */}
    <div className="absolute inset-0 opacity-[0.05]" style={{ filter: 'url(#noise)' }} />

    {/* Ambient Light/Depth Gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-black/90" />

    {/* Inner Precision Border */}
    <div className="absolute inset-[12px] rounded-[18px] border border-white/[0.05] shadow-[inset_0_0_25px_rgba(0,0,0,0.6)]" />

    {/* Central Ghost Graphic */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 opacity-[0.015]">
      <Hexagon className="w-full h-full stroke-[0.5] text-white fill-transparent" />
    </div>

    {/* Edge Highlight */}
    <div className="absolute inset-0 rounded-[26px] border border-white/[0.12] opacity-40" />
  </div>
);

const WhiteSteelTexture = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[26px] bg-[#f8f8fa]">
    {/* Brushed Metal Effect */}
    <div className="absolute inset-0 opacity-[0.4] bg-[repeating-linear-gradient(90deg,transparent,transparent_1px,rgba(0,0,0,0.01)_1px,transparent_2px)]" />

    {/* Noise */}
    <div className="absolute inset-0 opacity-[0.03]" style={{ filter: 'url(#noise)' }} />

    {/* Inner Precision Border */}
    <div className="absolute inset-[12px] rounded-[18px] border border-black/[0.04] shadow-[inset_0_0_15px_rgba(0,0,0,0.03)]" />

    {/* Edge Highlight */}
    <div className="absolute inset-0 rounded-[26px] border border-white shadow-[inset_0_1px_2px_rgba(255,255,255,1),0_0_0_1px_rgba(0,0,0,0.05)]" />
  </div>
);

export const NeuroNexCard = ({
  name,
  bankName = "NEURONEX",
  bankCode,
  agency = "0001",
  account = "**** 8829",
  accountType = "Conta corrente",
  isExpanded = false,
  onToggle,
  className,
  showSensitive = false
}: NeuroNexCardProps) => {
  const shouldReduceMotion = useReducedMotionPreference();
  const lastFour = account.replace(/[^\d]/g, '').slice(-4);
  const displayAccount = showSensitive
    ? account
    : lastFour
      ? `•••• •••• •••• ${lastFour}`
      : "Não informada";
  const isInteractive = Boolean(onToggle);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onToggle || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onToggle();
  };

  return (
    <>
      <NoiseTexture />
      <motion.div
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-expanded={isInteractive ? isExpanded : undefined}
        aria-label={
          isInteractive
            ? isExpanded
              ? "Recolher detalhes do cartão NeuroFinance"
              : "Expandir detalhes do cartão NeuroFinance"
            : undefined
        }
        className={cn(
          "relative w-[374px] group/card",
          isInteractive && "cursor-pointer rounded-[26px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background",
          className,
        )}
        style={{
          height: isExpanded ? 424 : 231,
        }}
        whileHover={shouldReduceMotion ? undefined : { scale: isExpanded ? 1 : 1.02 }}
        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 150, damping: 25 }}
        onClick={onToggle}
        onKeyDown={isInteractive ? handleKeyDown : undefined}
      >
        <div className="absolute top-0 left-0 w-full h-[231px] group">
          {/* Selective Light Up (Premium Shine) */}
          <motion.div
            data-card-shine="true"
            className={cn(
              "absolute -inset-px rounded-[26px] opacity-0 pointer-events-none z-20",
              shouldReduceMotion
                ? "transition-none"
                : "group-hover/card:opacity-100 transition-opacity duration-700",
            )}
            style={{
              background: `radial-gradient(circle at center, rgba(255,255,255,0.08) 0%, transparent 70%)`
            }}
          />

          {/* BACK CARD (Functional/Details) */}
          <motion.div
            initial={false}
            animate={{
              y: isExpanded ? 193 : 0,
              scale: isExpanded ? 1 : 0.94,
              opacity: isExpanded ? 1 : 0,
              zIndex: 1
            }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
            className={cn(
              "absolute inset-0 rounded-[26px] p-9 flex flex-col justify-between shadow-2xl overflow-hidden",
              shouldReduceMotion ? "transition-none" : "transition-all duration-700",
            )}
          >
            <div className="absolute inset-0 dark:block hidden">
              <WhiteSteelTexture />
            </div>
            <div className="absolute inset-0 block dark:hidden">
              <MatteBlackTexture />
            </div>

            <div className="relative z-10 px-2 py-1">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/90 dark:text-zinc-800">{bankName}</span>
                  <span className="text-white/45 dark:text-zinc-300">/</span>
                  <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/65 dark:text-zinc-500">CONTA CADASTRADA</span>
                </div>
                <ShieldCheck className="w-4 h-4 text-white/45 dark:text-zinc-300" />
              </div>

              <div className="space-y-7 pl-1">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[7px] font-bold uppercase tracking-[0.25em] mb-1.5 text-white/65 dark:text-zinc-500">Agência</p>
                    <p className="text-[17px] font-mono font-bold tracking-tight text-white/90 dark:text-zinc-800">{agency}</p>
                  </div>
                  <div>
                    <p className="text-[7px] font-bold uppercase tracking-[0.25em] mb-1.5 text-white/65 dark:text-zinc-500">Conta</p>
                    <p className="text-[17px] font-mono font-bold tracking-tight text-white/90 dark:text-zinc-800">{displayAccount}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-2">
                  <div>
                    <p className="text-[7px] font-bold uppercase tracking-[0.25em] mb-1.5 text-white/65 dark:text-zinc-500">Tipo</p>
                    <p className="text-[11px] font-bold tracking-wide text-white/80 dark:text-zinc-700">{accountType}</p>
                  </div>
                  <div>
                    <p className="text-[7px] font-bold uppercase tracking-[0.25em] mb-1.5 text-white/65 dark:text-zinc-500">Banco</p>
                    <p className="text-[11px] font-mono font-bold tracking-widest text-white/80 dark:text-zinc-700">{bankCode || bankName}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* FRONT CARD (Aesthetic) */}
          <motion.div
            animate={{
              y: isExpanded ? -8 : 0,
              zIndex: 10
            }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 22 }}
            className={cn(
              "absolute inset-0 rounded-[26px] p-9 flex flex-col justify-between overflow-hidden",
              "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] group-hover:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)]",
              shouldReduceMotion ? "transition-none" : "transition-all duration-500",
            )}
          >
            <div className="absolute inset-0 dark:block hidden">
              <MatteBlackTexture />
            </div>
            <div className="absolute inset-0 block dark:hidden">
              <WhiteSteelTexture />
            </div>

            <div className="relative z-10 h-full flex flex-col justify-between px-2 py-1">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black tracking-[0.2em] uppercase text-zinc-800 dark:text-white/90">NEURONEX</span>
                  <span className="font-light text-zinc-400 dark:text-zinc-600">/</span>
                  <span className="max-w-[150px] truncate text-[11px] font-bold tracking-[0.12em] uppercase text-zinc-500 dark:text-zinc-500">{bankName}</span>
                </div>
                <Wifi className="w-5 h-5 rotate-90 text-zinc-300 dark:text-white/20" />
              </div>

              <div className="flex items-center">
                <SilverChip />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex gap-2 text-[22px] tracking-widest mt-1 text-zinc-300 dark:text-white/40">
                    <span>••••</span>
                    <span>••••</span>
                    <span>••••</span>
                  </div>
                  <span className="text-[22px] font-mono font-bold tracking-widest text-zinc-800 dark:text-white/95">{lastFour || "----"}</span>
                </div>

                <div className="flex justify-between items-end border-t pt-3 border-zinc-200 dark:border-white/5">
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-700 dark:text-white/90">{name}</p>
                  <div className="flex flex-col items-end">
                    <p className="text-[6px] font-bold uppercase tracking-widest mb-0.5 text-zinc-400 dark:text-white/40">MEMBER SINCE</p>
                    <p className="text-[10px] font-medium tracking-widest text-zinc-800 dark:text-white">2026</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
};
