"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, CircleDot, Users } from "lucide-react";
import { useMemo, useState } from "react";

import type { GraphLink, GraphNode } from "./graph/graph-types";

type SidebarGraphData = {
    nodes: GraphNode[];
    links: GraphLink[];
};

interface NeuroViewSidebarProps {
    patients: Patient[];
    graphData?: SidebarGraphData;
    darkMode: boolean;
    onHoverNode: (id: string | null) => void;
    onSelectPatient: (patient: Patient) => void;
    onSelectNode?: (node: GraphNode) => void;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const NODE_TYPE_LABEL: Record<GraphNode["type"], string> = {
    patient: "Paciente",
    flow: "Fluxo",
    note: "Nota",
    evidence: "Evidência",
    tag: "Tag",
};

const NODE_TYPE_ORDER: Record<GraphNode["type"], number> = {
    patient: 0,
    flow: 1,
    note: 2,
    evidence: 3,
    tag: 4,
};

const endpointId = (endpoint: GraphLink["source"] | GraphLink["target"]) => (
    typeof endpoint === "string" ? endpoint : endpoint?.id
);

export const NeuroViewSidebar = ({
    patients,
    graphData,
    darkMode,
    onHoverNode,
    onSelectPatient,
    onSelectNode,
    isOpen,
    onOpenChange,
}: NeuroViewSidebarProps) => {
    const reducedMotion = useReducedMotion();
    const [expandedPatientIds, setExpandedPatientIds] = useState<Set<string>>(new Set());

    const nodesByPatient = useMemo(() => {
        const nodes = graphData?.nodes || [];
        const links = graphData?.links || [];
        const nodeById = new Map(nodes.map((node) => [node.id, node]));

        return new Map(patients.map((patient) => {
            const patientNodeId = `pat-${patient.id}`;
            const includedIds = new Set<string>();

            nodes.forEach((node) => {
                if (node.id !== patientNodeId && String(node.data?.patient_id || "") === patient.id) includedIds.add(node.id);
            });

            links.forEach((link) => {
                const sourceId = endpointId(link.source);
                const targetId = endpointId(link.target);
                if (sourceId === patientNodeId && targetId) includedIds.add(targetId);
                if (targetId === patientNodeId && sourceId) includedIds.add(sourceId);
            });

            const clinicalIds = new Set(Array.from(includedIds).filter((id) => nodeById.get(id)?.type !== "tag"));
            links.forEach((link) => {
                const sourceId = endpointId(link.source);
                const targetId = endpointId(link.target);
                if (!sourceId || !targetId) return;
                if (clinicalIds.has(sourceId) && nodeById.get(targetId)?.type === "tag") includedIds.add(targetId);
                if (clinicalIds.has(targetId) && nodeById.get(sourceId)?.type === "tag") includedIds.add(sourceId);
            });

            const patientNodes = Array.from(includedIds)
                .map((id) => nodeById.get(id))
                .filter((node): node is GraphNode => Boolean(node) && node?.type !== "patient")
                .sort((left, right) => NODE_TYPE_ORDER[left.type] - NODE_TYPE_ORDER[right.type]
                    || left.label.localeCompare(right.label, "pt-BR"));
            return [patient.id, patientNodes] as const;
        }));
    }, [graphData?.links, graphData?.nodes, patients]);

    const getInitials = (name: string) => name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    const togglePatient = (patientId: string) => {
        setExpandedPatientIds((current) => {
            const next = new Set(current);
            if (next.has(patientId)) next.delete(patientId);
            else next.add(patientId);
            return next;
        });
    };

    return (
        <div className="pointer-events-none absolute bottom-20 left-5 top-[78px] z-40 flex">
            <AnimatePresence mode="wait">
                {isOpen ? (
                    <motion.aside
                        key="sidebar-open"
                        initial={reducedMotion ? false : { opacity: 0, x: -18, width: 0 }}
                        animate={{ opacity: 1, x: 0, width: 244 }}
                        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -18, width: 0 }}
                        transition={reducedMotion ? { duration: 0 } : { type: "spring", damping: 31, stiffness: 320 }}
                        className={cn(
                            "pointer-events-auto flex h-full flex-col overflow-hidden rounded-[26px] border shadow-[0_30px_90px_-48px_rgba(0,0,0,0.9)] backdrop-blur-3xl",
                            darkMode
                                ? "border-white/[0.09] bg-[#070708]/82 text-white"
                                : "border-black/[0.075] bg-white/88 text-zinc-950 shadow-[0_28px_80px_-46px_rgba(24,24,27,0.36),inset_0_1px_0_rgba(255,255,255,0.96)]",
                        )}
                        aria-label="Pacientes e nós do NeuroVision"
                    >
                        <div className={cn("flex flex-col gap-2.5 border-b p-3", darkMode ? "border-white/[0.07] bg-white/[0.025]" : "border-black/[0.055] bg-black/[0.018]")}>
                            <div className="flex items-center justify-between gap-3">
                                <span className={cn("flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.17em]", darkMode ? "text-white" : "text-zinc-900")}>
                                    <Users className={cn("h-3.5 w-3.5", darkMode ? "text-white/55" : "text-zinc-500")} /> Pacientes e nós
                                </span>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => onOpenChange(false)}
                                    className={cn("h-7 w-7 rounded-xl", darkMode ? "text-white/50 hover:bg-white/[0.07] hover:text-white" : "text-zinc-500 hover:bg-black/[0.05] hover:text-zinc-950")}
                                    aria-label="Recolher pacientes e nós"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <p className={cn("text-[8.5px] font-black uppercase tracking-[0.2em]", darkMode ? "text-white/32" : "text-zinc-400")}>
                                {patients.length} {patients.length === 1 ? "paciente" : "pacientes"} · {graphData?.nodes.length || patients.length} nós
                            </p>
                        </div>

                        <div className="relative flex-1 overflow-hidden">
                            <div className="custom-scrollbar absolute inset-0 space-y-1 overflow-y-auto p-2 pb-5">
                                {patients.length === 0 ? (
                                    <div className={cn("flex flex-col items-center justify-center gap-2 py-12", darkMode ? "text-white/30" : "text-zinc-400")}>
                                        <Users className="h-8 w-8 opacity-20" />
                                        <p className="px-4 text-center text-[10px] font-medium">Nenhum paciente</p>
                                    </div>
                                ) : patients.map((patient) => {
                                    const expanded = expandedPatientIds.has(patient.id);
                                    const patientNodes = nodesByPatient.get(patient.id) || [];
                                    return (
                                        <div key={patient.id} className="overflow-hidden rounded-[17px]">
                                            <div className={cn("group flex items-center rounded-[17px] border border-transparent transition-colors", darkMode ? "hover:border-white/[0.06] hover:bg-white/[0.04]" : "hover:border-black/[0.055] hover:bg-black/[0.025]")}>
                                                <button
                                                    type="button"
                                                    onMouseEnter={() => onHoverNode(`pat-${patient.id}`)}
                                                    onMouseLeave={() => onHoverNode(null)}
                                                    onClick={() => onSelectPatient(patient)}
                                                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-l-[16px] p-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current/35"
                                                >
                                                    <Avatar className={cn("h-7 w-7 shadow-sm ring-1", darkMode ? "ring-white/10" : "ring-black/[0.08]")}>
                                                        <AvatarImage src={patient.avatar_url || undefined} />
                                                        <AvatarFallback className={cn("text-[8.5px] font-black", darkMode ? "bg-[#1A1A1D] text-white/60" : "bg-zinc-100 text-zinc-500")}>
                                                            {getInitials(patient.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="min-w-0 flex-1">
                                                        <span className={cn("block truncate text-[11px] font-semibold", darkMode ? "text-white/68 group-hover:text-white" : "text-zinc-600 group-hover:text-zinc-950")}>{patient.name}</span>
                                                        <span className={cn("block text-[8px] font-medium", darkMode ? "text-white/30" : "text-zinc-400")}>{patientNodes.length} nós vinculados</span>
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => togglePatient(patient.id)}
                                                    className={cn("mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/35", darkMode ? "text-white/38 hover:bg-white/[0.07] hover:text-white" : "text-zinc-400 hover:bg-black/[0.045] hover:text-zinc-900")}
                                                    aria-label={`${expanded ? "Recolher" : "Expandir"} nós de ${patient.name}`}
                                                    aria-expanded={expanded}
                                                >
                                                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-90")} />
                                                </button>
                                            </div>

                                            <AnimatePresence initial={false}>
                                                {expanded ? (
                                                    <motion.ul
                                                        initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                                        transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                                        className={cn("ml-5 overflow-hidden border-l pl-2", darkMode ? "border-white/[0.07]" : "border-black/[0.065]")}
                                                    >
                                                        {patientNodes.length ? patientNodes.map((node) => (
                                                            <li key={node.id}>
                                                                <button
                                                                    type="button"
                                                                    onMouseEnter={() => onHoverNode(node.id)}
                                                                    onMouseLeave={() => onHoverNode(null)}
                                                                    onFocus={() => onHoverNode(node.id)}
                                                                    onBlur={() => onHoverNode(null)}
                                                                    onClick={() => onSelectNode?.(node)}
                                                                    className={cn(
                                                                        "flex min-h-10 w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                                                                        darkMode ? "text-white/54 hover:bg-white/[0.055] hover:text-white focus-visible:ring-white/35" : "text-zinc-500 hover:bg-black/[0.035] hover:text-zinc-950 focus-visible:ring-zinc-950/25",
                                                                    )}
                                                                >
                                                                    <CircleDot className="h-3 w-3 shrink-0 opacity-55" />
                                                                    <span className="min-w-0 flex-1">
                                                                        <span className="block truncate text-[10px] font-semibold">{node.label || "Sem título"}</span>
                                                                        <span className="block text-[7.5px] font-bold uppercase tracking-[0.12em] opacity-45">{NODE_TYPE_LABEL[node.type]}</span>
                                                                    </span>
                                                                </button>
                                                            </li>
                                                        )) : (
                                                            <li className={cn("px-2 py-3 text-[9px]", darkMode ? "text-white/30" : "text-zinc-400")}>Nenhum nó vinculado.</li>
                                                        )}
                                                    </motion.ul>
                                                ) : null}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.aside>
                ) : null}
            </AnimatePresence>
        </div>
    );
};

export const NeuroVisionSidebar = NeuroViewSidebar;
