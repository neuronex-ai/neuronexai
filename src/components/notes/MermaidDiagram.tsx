import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { renderMermaidSvg } from "@/lib/mermaid-renderer";
import { cn } from "@/lib/utils";
import { AlertTriangle, Code, Loader2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

interface MermaidDiagramProps {
  chart: string;
  compact?: boolean;
  className?: string;
  layoutKey?: string | number;
  progressiveReveal?: {
    nodeIds: string[];
    edgeCount: number;
    complete: boolean;
  };
}

export const MermaidDiagram = ({ chart, compact = false, className, layoutKey = "default", progressiveReveal }: MermaidDiagramProps) => {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    const debounceId = window.setTimeout(() => {
      if (!chart.trim()) {
        setSvg("");
        setError("O diagrama ainda não possui conteúdo.");
        return;
      }

      setError(null);
      setSvg("");

      void renderMermaidSvg(chart, theme).then(
        (nextSvg) => {
          if (!cancelled) setSvg(nextSvg);
        },
        (renderError) => {
          if (cancelled) return;
          console.error("Mermaid Render Error:", renderError);
          setError("Não foi possível montar o diagrama. Revise a sintaxe Mermaid.");
        },
      );
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceId);
    };
  }, [chart, theme]);

  useEffect(() => {
    if (!svg || !containerRef.current || !progressiveReveal) return;
    const allowedNodes = new Set(progressiveReveal.nodeIds);
    const nodeGroups = Array.from(containerRef.current.querySelectorAll<SVGGElement>("g.node"));
    nodeGroups.forEach((node) => {
      const visible = progressiveReveal.complete || Array.from(allowedNodes).some((id) => (
        node.id === id || node.id.includes(`-${id}-`) || node.id.endsWith(`-${id}`)
      ));
      node.style.transition = "opacity 360ms cubic-bezier(0.22, 1, 0.36, 1), filter 420ms cubic-bezier(0.22, 1, 0.36, 1)";
      node.style.opacity = visible ? "1" : "0";
      node.style.filter = visible ? "blur(0px)" : "blur(8px)";
      node.style.pointerEvents = visible ? "auto" : "none";
    });

    const edgeGroups = Array.from(containerRef.current.querySelectorAll<SVGGElement>("g.edgePath"));
    edgeGroups.forEach((edge, index) => {
      const visible = progressiveReveal.complete || index < progressiveReveal.edgeCount;
      edge.style.transition = "opacity 300ms cubic-bezier(0.22, 1, 0.36, 1)";
      edge.style.opacity = visible ? "1" : "0";
    });
    const edgeLabels = Array.from(containerRef.current.querySelectorAll<SVGGElement>("g.edgeLabel"));
    edgeLabels.forEach((label, index) => {
      label.style.transition = "opacity 300ms cubic-bezier(0.22, 1, 0.36, 1)";
      label.style.opacity = progressiveReveal.complete || index < progressiveReveal.edgeCount ? "1" : "0";
    });
  }, [progressiveReveal, svg]);

  if (error) {
    return (
      <div
        role="alert"
        className={cn(
          "flex h-full flex-col items-center justify-center rounded-xl border border-rose-500/20 bg-zinc-50 text-center dark:bg-[#0F0F11]/50",
          compact ? "m-0 p-4" : "m-4 p-8",
          className,
        )}
      >
        <div className={cn("mb-4 flex items-center justify-center rounded-full bg-rose-500/10", compact ? "h-9 w-9" : "h-12 w-12")}>
          <AlertTriangle className={cn("text-rose-500", compact ? "h-4 w-4" : "h-6 w-6")} />
        </div>
        <p className={cn("mb-2 font-bold text-zinc-900 dark:text-white", compact ? "text-xs" : "text-sm")}>
          Falha na visualização
        </p>
        <p className={cn("mb-4 max-w-xs text-zinc-500 dark:text-zinc-400", compact ? "text-[10px]" : "text-xs")}>
          {error}
        </p>

        <div className={cn("w-full max-w-md rounded-lg border border-zinc-200 bg-zinc-200/40 text-left dark:border-white/5 dark:bg-black/40", compact ? "p-2" : "p-3")}>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <Code className="h-3 w-3" /> Debug
          </div>
          <pre className={cn("overflow-auto whitespace-pre-wrap break-all font-mono text-zinc-500 dark:text-zinc-400", compact ? "max-h-20 text-[8px]" : "max-h-32 text-[10px]")}>
            {chart}
          </pre>
        </div>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center gap-4", className)}>
        <Loader2 aria-hidden="true" className={cn("animate-spin motion-reduce:animate-none text-zinc-900/20 dark:text-white/20", compact ? "h-5 w-5" : "h-8 w-8")} />
        <span role="status" aria-live="polite" className={cn("font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-600", compact ? "text-[8px]" : "text-[10px]")}>
          Construindo gráfico...
        </span>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Diagrama Mermaid interativo"
      className={cn("group relative flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-white dark:bg-[#060606]", compact && "rounded-2xl", className)}
      ref={containerRef}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />

      <TransformWrapper
        key={`${compact ? "compact" : "full"}-${layoutKey}-${svg.length}`}
        initialScale={compact ? 0.82 : 1}
        minScale={compact ? 0.35 : 0.5}
        maxScale={compact ? 2.5 : 4}
        centerOnInit
        limitToBounds={false}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {!compact && (
              <div className="absolute bottom-6 right-6 z-20 flex translate-y-2 flex-col gap-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white/90 p-1 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#151518]/90">
                  <Button variant="ghost" size="icon" onClick={() => zoomIn()} className="h-8 w-8 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white">
                    <span className="sr-only">Ampliar diagrama</span>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => zoomOut()} className="h-8 w-8 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white">
                    <span className="sr-only">Reduzir diagrama</span>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <div className="my-0.5 h-px w-full bg-zinc-200 dark:bg-white/10" />
                  <Button variant="ghost" size="icon" onClick={() => resetTransform()} className="h-8 w-8 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white">
                    <span className="sr-only">Restaurar enquadramento do diagrama</span>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <TransformComponent
              wrapperClass="w-full h-full"
              contentClass="w-full h-full flex items-center justify-center"
              wrapperStyle={{ width: "100%", height: "100%" }}
              contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: svg }}
                className="mermaid-svg-container flex h-full min-h-0 w-full min-w-0 items-center justify-center [&_svg]:block [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:max-w-full"
                style={{
                  opacity: 0.9,
                  filter: "drop-shadow(0 0 20px rgba(255,255,255,0.05))",
                  padding: compact ? "14px" : "40px",
                }}
              />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
};
