import { SiriWave } from "@/components/ui/siri-wave"
import { cn } from "@/lib/utils"

type LoadingSurface = "page" | "section" | "inline"

interface NeuroNexLoadingLoopProps {
  className?: string
  label?: string
  size?: number
  surface?: LoadingSurface
}

export function NeuroNexLoadingLoop({
  className,
  label = "Carregando",
  size,
  surface = "section",
}: NeuroNexLoadingLoopProps) {
  const resolvedSize = size ?? (surface === "page" ? 128 : surface === "section" ? 96 : 72)

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        surface === "page" && "min-h-[100dvh] w-full bg-background",
        surface === "section" && "min-h-[280px] w-full bg-transparent",
        surface === "inline" && "w-auto bg-transparent",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-neuronex-loading-loop
    >
      <SiriWave
        aria-hidden="true"
        variant="fluid-dots"
        size={resolvedSize}
        renderScale={0.85}
        className="shrink-0 shadow-[0_18px_50px_rgba(0,0,0,0.48)]"
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export default NeuroNexLoadingLoop
