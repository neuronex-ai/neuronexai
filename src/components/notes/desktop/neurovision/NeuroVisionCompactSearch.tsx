"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NeuroVisionCompactSearchProps = {
  value: string;
  onValueChange: (value: string) => void;
  darkMode: boolean;
  placeholder?: string;
  variant?: "floating" | "sidebar";
};

export const NeuroVisionCompactSearch = ({
  value,
  onValueChange,
  darkMode,
  placeholder = "Buscar no NeuroVision",
  variant = "floating",
}: NeuroVisionCompactSearchProps) => {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const collapseOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", collapseOutside);
    return () => document.removeEventListener("pointerdown", collapseOutside);
  }, [expanded]);

  const open = () => {
    setExpanded(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  if (variant === "sidebar") {
    return (
      <div
        className={cn(
          "flex h-10 w-full items-center rounded-[13px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] transition-colors duration-200 focus-within:ring-2 motion-reduce:transition-none",
          darkMode
            ? "border-white/[0.065] bg-white/[0.035] text-white focus-within:border-white/12 focus-within:bg-white/[0.055] focus-within:ring-white/18"
            : "border-zinc-200/75 bg-white/78 text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.96)] focus-within:border-zinc-300 focus-within:bg-white focus-within:ring-zinc-950/10",
        )}
        role="search"
      >
        <Search className={cn("ml-3 h-3.5 w-3.5 shrink-0", darkMode ? "text-white/38" : "text-zinc-400")} aria-hidden="true" />
        <Input
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            if (value) onValueChange("");
            else event.currentTarget.blur();
          }}
          placeholder={placeholder}
          aria-label="Buscar pacientes, notas e nós"
          className={cn(
            "h-9 min-w-0 flex-1 border-0 bg-transparent px-2 text-[11px] shadow-none focus-visible:ring-0",
            darkMode ? "text-white placeholder:text-white/28" : "text-zinc-950 placeholder:text-zinc-400",
          )}
        />
        {value ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onValueChange("")}
            aria-label="Limpar busca"
            className={cn(
              "mr-1 h-8 w-8 shrink-0 rounded-[10px]",
              darkMode ? "text-white/38 hover:bg-white/[0.08] hover:text-white" : "text-zinc-400 hover:bg-black/[0.045] hover:text-zinc-900",
            )}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <motion.div
      ref={rootRef}
      layout
      initial={false}
      animate={{ width: expanded ? 292 : 46 }}
      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 38, mass: 0.72 }}
      className={cn(
        "pointer-events-auto relative flex h-11 items-center overflow-hidden rounded-[18px] border shadow-[0_22px_64px_-38px_rgba(0,0,0,0.86),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl",
        darkMode
          ? "border-white/10 bg-black/58 text-white"
          : "border-black/[0.075] bg-white/88 text-zinc-950 shadow-[0_20px_52px_-34px_rgba(24,24,27,0.32),inset_0_1px_0_rgba(255,255,255,0.96)]",
      )}
      data-expanded={expanded ? "true" : "false"}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false);
      }}
    >
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={open}
        aria-label={expanded ? "Focar busca do NeuroVision" : "Abrir busca do NeuroVision"}
        aria-expanded={expanded}
        className={cn(
          "h-11 w-11 shrink-0 rounded-[17px]",
          darkMode ? "text-white/62 hover:bg-white/10 hover:text-white" : "text-zinc-500 hover:bg-black/5 hover:text-zinc-950",
          value && !expanded && (darkMode ? "text-white" : "text-zinc-950"),
        )}
      >
        <Search className="h-4 w-4" />
      </Button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -6 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.18 }}
            className="flex min-w-0 flex-1 items-center pr-1"
          >
            <Input
              ref={inputRef}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                event.stopPropagation();
                setExpanded(false);
                inputRef.current?.blur();
              }}
              placeholder={placeholder}
              className={cn(
                "h-9 min-w-0 flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0",
                darkMode ? "text-white placeholder:text-white/34" : "text-zinc-950 placeholder:text-zinc-400",
              )}
            />
            {value ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  onValueChange("");
                  inputRef.current?.focus();
                }}
                aria-label="Limpar busca"
                className={cn(
                  "h-8 w-8 shrink-0 rounded-xl",
                  darkMode ? "text-white/42 hover:bg-white/10 hover:text-white" : "text-zinc-400 hover:bg-black/5 hover:text-zinc-900",
                )}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
};
