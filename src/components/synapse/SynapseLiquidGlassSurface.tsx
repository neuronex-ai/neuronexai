import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type SynapseLiquidGlassVariant = 'chrome' | 'card' | 'subtle';

type SynapseLiquidGlassSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  variant?: SynapseLiquidGlassVariant;
};

const VARIANT_CLASSES: Record<SynapseLiquidGlassVariant, string> = {
  chrome:
    'border-zinc-950/[0.10] bg-white/72 shadow-[0_22px_58px_-44px_rgba(24,24,27,0.68),inset_0_1px_0_rgba(255,255,255,0.84),inset_0_-1px_0_rgba(24,24,27,0.035)] dark:border-white/[0.075] dark:bg-zinc-950/58 dark:shadow-[0_24px_64px_-46px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.055),inset_0_-1px_0_rgba(0,0,0,0.72)]',
  card:
    'border-zinc-950/[0.085] bg-white/66 shadow-[0_18px_48px_-42px_rgba(24,24,27,0.58),inset_0_1px_0_rgba(255,255,255,0.80)] dark:border-white/[0.06] dark:bg-white/[0.035] dark:shadow-[0_22px_56px_-46px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.035)]',
  subtle:
    'border-zinc-950/[0.065] bg-white/48 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] dark:border-white/[0.05] dark:bg-white/[0.025] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]',
};

export const SynapseLiquidGlassSurface = forwardRef<
  HTMLDivElement,
  SynapseLiquidGlassSurfaceProps
>(function SynapseLiquidGlassSurface(
  { variant = 'card', className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-synapse-liquid-glass="true"
      className={cn(
        'relative isolate overflow-hidden border backdrop-blur-[28px] backdrop-saturate-[1.14]',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(145deg,rgba(255,255,255,0.30),rgba(255,255,255,0.05)_38%,transparent_64%)] opacity-65 dark:bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015)_38%,transparent_64%)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-5 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/75 to-transparent dark:via-white/12"
      />
      {children}
    </div>
  );
});
