"use client";

import { useState, type ReactNode } from "react";
import { Calendar, Filter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type PopoverAlign = "start" | "center" | "end";

export interface FilterOption<T extends string> {
    id: T;
    label: string;
}

interface AdvancedFilterPopoverProps {
    activeFilters: number;
    children: ReactNode;
    onClear: () => void;
    onApply?: () => void;
    triggerLabel?: string;
    clearLabel?: string;
    applyLabel?: string;
    align?: PopoverAlign;
    widthClassName?: string;
    presentation?: "popover" | "dialog";
    title?: string;
    description?: string;
}

export function AdvancedFilterPopover({
    activeFilters,
    children,
    onClear,
    onApply,
    triggerLabel = "Filtros",
    clearLabel = "Limpar",
    applyLabel = "Aplicar",
    align = "start",
    widthClassName = "w-[min(960px,calc(100vw-56px))]",
    presentation = "popover",
    title = "Filtros avançados",
    description = "Refine os resultados exibidos.",
}: AdvancedFilterPopoverProps) {
    const [open, setOpen] = useState(false);

    const trigger = (
        <Button variant="outline" className="h-12 rounded-[18px] border-zinc-200 bg-white/70 px-5 text-[10px] font-black uppercase tracking-[0.18em] dark:border-white/10 dark:bg-white/[0.035]">
            <Filter className="mr-2 h-4 w-4" />
            {triggerLabel} {activeFilters > 0 ? `(${activeFilters})` : ""}
        </Button>
    );

    const footer = (
        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 bg-zinc-50/60 px-6 py-5 backdrop-blur-xl dark:border-white/5 dark:bg-white/[0.025]">
            <Button variant="ghost" onClick={onClear} className="h-11 rounded-full px-6 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">
                {clearLabel}
            </Button>
            <Button
                onClick={() => {
                    onApply?.();
                    setOpen(false);
                }}
                className="h-11 rounded-full bg-zinc-950 px-7 text-[9px] font-black uppercase tracking-[0.14em] text-white shadow-lg transition-all active:scale-95 dark:bg-white dark:text-zinc-950"
            >
                {applyLabel}
            </Button>
        </div>
    );

    if (presentation === "dialog") {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>{trigger}</DialogTrigger>
                <DialogContent showCloseButton={false} className={cn(widthClassName, "max-w-none gap-0 overflow-hidden rounded-[28px] border border-zinc-200 bg-white/95 p-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] backdrop-blur-[40px] duration-150 dark:border-white/[0.08] dark:bg-[#09090b]/95 dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)]")}>
                    <div className="premium-noise pointer-events-none absolute inset-0 opacity-[0.015] dark:opacity-[0.035]" />
                    <div className="relative z-10 flex items-start justify-between border-b border-zinc-100 px-8 pb-5 pt-7 dark:border-white/5">
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight text-zinc-950 dark:text-white">{title}</DialogTitle>
                            <DialogDescription className="mt-1.5 text-xs font-medium text-zinc-500">{description}</DialogDescription>
                        </div>
                        <DialogClose asChild>
                            <Button variant="ghost" size="icon" title="Fechar filtros" className="h-10 w-10 rounded-full text-zinc-400 transition-all hover:bg-zinc-100 hover:text-zinc-900 active:scale-90 dark:hover:bg-white/5 dark:hover:text-white">
                                <X className="h-5 w-5" />
                            </Button>
                        </DialogClose>
                    </div>
                    <div className="relative z-10 bg-zinc-50/50 dark:bg-black/20">{children}</div>
                    <div className="relative z-10">{footer}</div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent align={align} sideOffset={12} className={cn(widthClassName, "overflow-hidden rounded-[28px] border-zinc-200 bg-white/95 p-0 shadow-[0_36px_90px_-36px_rgba(0,0,0,0.45)] backdrop-blur-3xl dark:border-white/10 dark:bg-zinc-950/95")}>
                {children}
                {footer}
            </PopoverContent>
        </Popover>
    );
}

export function FilterDateGroup({
    title,
    start,
    end,
    onStart,
    onEnd,
    compact = false,
}: {
    title: string;
    start: string;
    end: string;
    onStart: (value: string) => void;
    onEnd: (value: string) => void;
    compact?: boolean;
}) {
    return (
        <div>
            <p className={cn("font-black text-zinc-900 dark:text-white", compact ? "mb-2 text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500" : "mb-3 text-sm tracking-tight")}>{title}</p>
            <div className={cn("flex flex-wrap items-center", compact ? "gap-2" : "gap-3")}>
                <DateInput value={start} onChange={onStart} compact={compact} />
                <span className="text-xs font-semibold text-zinc-400">até</span>
                <DateInput value={end} onChange={onEnd} compact={compact} />
            </div>
        </div>
    );
}

export function DateInput({
    value,
    onChange,
    compact = false,
}: {
    value: string;
    onChange: (value: string) => void;
    compact?: boolean;
}) {
    return (
        <div className="relative">
            <input
                type="date"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className={cn(
                    "rounded-[12px] border border-zinc-200 bg-white px-3 pr-9 text-xs font-bold text-zinc-700 shadow-sm outline-none transition-all focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:focus:border-white/20",
                    compact ? "h-10 w-[140px]" : "h-11 w-[150px]",
                )}
            />
            <Calendar className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        </div>
    );
}

export function FilterCheckGroup<T extends string>({
    title,
    options,
    selected,
    onToggle,
    twoColumns = false,
    compact = false,
}: {
    title: string;
    options: FilterOption<T>[];
    selected: T[];
    onToggle: (id: T) => void;
    twoColumns?: boolean;
    compact?: boolean;
}) {
    return (
        <div>
            <p className={cn("font-black text-zinc-900 dark:text-white", compact ? "mb-2.5 text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500" : "mb-4 text-sm tracking-tight")}>{title}</p>
            <div className={cn("grid", compact ? "gap-2" : "gap-3", twoColumns ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
                {options.map((option) => (
                    <label key={option.id} className={cn("flex cursor-pointer items-center font-semibold text-zinc-600 dark:text-zinc-300", compact ? "gap-2.5 text-xs" : "gap-3 text-sm")}>
                        <Checkbox className={compact ? "h-4 w-4 rounded-[5px] border-zinc-300 dark:border-white/20" : undefined} checked={selected.includes(option.id)} onCheckedChange={() => onToggle(option.id)} />
                        {option.label}
                    </label>
                ))}
            </div>
        </div>
    );
}
