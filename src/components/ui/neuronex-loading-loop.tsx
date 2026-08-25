import { Loader2 } from "lucide-react"

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
  const defaultSize = surface === "page" ? 32 : surface === "section" ? 28 : 20
  const resolvedSize = Math.min(size ?? defaultSize, 40)

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
      <Loader2
        aria-hidden="true"
        className="shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
        style={{ width: resolvedSize, height: resolvedSize }}
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export default NeuroNexLoadingLoop
