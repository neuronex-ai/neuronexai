import { lazy, Suspense, useEffect, useRef, useState, useMemo, useCallback } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { forceCollide, forceRadial, forceX, forceY } from "d3-force";
import { usePersonalNotes } from "@/hooks/use-personal-notes";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NeuroConfig, NeuroViewControls } from "./NeuroViewControls";
import { NeuroViewSidebar } from "./NeuroViewSidebar";
import { GraphNode, GraphLink } from "./graph/graph-types";
import { useGraphData } from "./graph/use-graph-data";
import { lerp, drawNode, drawLink } from "./graph/canvas-renderers";
import { GraphDetailsPanel } from "./graph/GraphDetailsPanel";
import { PersonalNote, Patient } from "@/types";
import { useTheme } from "@/hooks/use-theme";
import { useSynapseNotesAgentRun, type SynapseNotesAgentTrace } from "@/hooks/use-synapse-notes-agent-run";
import { useReducedMotion } from "framer-motion";
import type { SynapseNeuroViewDirective } from "@/lib/synapse-interface-actions";
import { detectNeuroViewHardware, type NeuroViewHardwareCapability } from "./neuroview-3d/webgl-support";
import { buildHoverEquivalentHighlight } from "./neuroview-3d/model";
import type { EvidenceNode } from "./clinical-evidence/evidence-types";

const NeuroView3D = lazy(() => import("./neuroview-3d/NeuroView3D"));

// --- DEFAULT CONFIG ---
const DEFAULT_CONFIG: NeuroConfig = {
    repulsion: -360,
    linkDistance: 96,
    centerForce: 0.055,
    performanceMode: false,
    showPatients: true,
    showNotes: true,
    showTags: true
};

// Dedicated to the planar D3 scene. The Three.js dynamics never read or write this state.
const NEUROVIEW_2D_CONFIG_STORAGE_KEY = "neuronex:desktop:neuroview:physics:v1";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const readStoredNeuroConfig = (): NeuroConfig => {
    if (typeof window === "undefined") return DEFAULT_CONFIG;

    try {
        const raw = window.localStorage.getItem(NEUROVIEW_2D_CONFIG_STORAGE_KEY);
        if (!raw) return DEFAULT_CONFIG;

        const parsed = JSON.parse(raw) as Partial<NeuroConfig>;

        return {
            ...DEFAULT_CONFIG,
            ...parsed,
            repulsion: typeof parsed.repulsion === "number" ? clamp(parsed.repulsion, -1300, -120) : DEFAULT_CONFIG.repulsion,
            linkDistance: typeof parsed.linkDistance === "number" ? clamp(parsed.linkDistance, 45, 210) : DEFAULT_CONFIG.linkDistance,
            centerForce: typeof parsed.centerForce === "number" ? clamp(parsed.centerForce, 0, 0.26) : DEFAULT_CONFIG.centerForce,
            performanceMode: typeof parsed.performanceMode === "boolean" ? parsed.performanceMode : DEFAULT_CONFIG.performanceMode,
            showPatients: typeof parsed.showPatients === "boolean" ? parsed.showPatients : DEFAULT_CONFIG.showPatients,
            showNotes: typeof parsed.showNotes === "boolean" ? parsed.showNotes : DEFAULT_CONFIG.showNotes,
            showTags: typeof parsed.showTags === "boolean" ? parsed.showTags : DEFAULT_CONFIG.showTags,
        };
    } catch {
        return DEFAULT_CONFIG;
    }
};

const getEndpointId = (endpoint: GraphLink["source"] | GraphLink["target"]) => (
    typeof endpoint === "string" ? endpoint : endpoint?.id
);

const getLinkKey = (link: GraphLink) => {
    const sourceId = getEndpointId(link.source);
    const targetId = getEndpointId(link.target);
    return `${sourceId || "unknown"}->${targetId || "unknown"}`;
};

interface NeuroViewProps {
    synapseRunId?: string | null;
    synapsePatientId?: string | null;
    synapseTrace?: unknown;
    synapseDirective?: SynapseNeuroViewDirective | null;
}

const asTrace = (value: unknown): SynapseNotesAgentTrace | null =>
    value && typeof value === "object" ? value as SynapseNotesAgentTrace : null;

export const NeuroView = ({ synapseRunId, synapsePatientId, synapseTrace, synapseDirective }: NeuroViewProps) => {
    const { theme } = useTheme();
    const isDarkMode = theme === "dark";
    const shouldReduceMotion = useReducedMotion();
    const { run, activeEvent, eventsLoaded } = useSynapseNotesAgentRun(synapseRunId);
    // Universe mode
    const [isUniverseMode, setIsUniverseMode] = useState(false);
    const [neuroView3DCapability, setNeuroView3DCapability] = useState<NeuroViewHardwareCapability | null>(null);
    const [webglFallbackMessage, setWebglFallbackMessage] = useState<string | null>(null);

    // 1. Refs
    const graphRef = useRef<ForceGraphMethods>();
    const containerRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number>();
    const animationTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const timeRef = useRef<number>(0);
    const [graphSize, setGraphSize] = useState({ width: 0, height: 0 });

    // 2. Data Hook
    const { updateNote, deleteNote } = usePersonalNotes();
    const [config, setConfig] = useState<NeuroConfig>(() => readStoredNeuroConfig());
    const [searchQuery, setSearchQuery] = useState("");
    const graphConfig = useMemo<NeuroConfig>(() => (
        synapseDirective || synapseRunId || synapsePatientId
            ? { ...config, showPatients: true, showNotes: true, showTags: true }
            : config
    ), [config, synapseDirective, synapsePatientId, synapseRunId]);

    const {
        graphData: completeGraphData,
        notes,
        patients,
        evidence,
        isEvidenceAvailable,
        updateEvidenceOverride,
        isLoading,
    } = useGraphData({ config: graphConfig, searchQuery });
    const activeTrace = useMemo(() => run?.trace || asTrace(synapseTrace), [run?.trace, synapseTrace]);
    const traceNodeIds = useMemo(() => (
        (activeTrace?.nodes || [])
            .map((node) => node.id)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
    ), [activeTrace]);
    const requestedNodeIds = useMemo(() => {
        const ids = synapseDirective?.nodeIds?.length ? synapseDirective.nodeIds : traceNodeIds;
        return Array.from(new Set(ids));
    }, [synapseDirective?.nodeIds, traceNodeIds]);
    const neuroViewScope = synapseDirective?.scope
        || (traceNodeIds.length ? "subgraph" : synapsePatientId ? "patient" : "all");
    const scopedNodeIds = useMemo(() => {
        if (neuroViewScope === "all") return null;

        if (neuroViewScope === "subgraph") {
            const ids = new Set(requestedNodeIds);
            if (synapseDirective?.focusNodeId) ids.add(synapseDirective.focusNodeId);
            return ids;
        }

        const patientNodeId = synapsePatientId ? `pat-${synapsePatientId}` : "";
        const nodeById = new Map(completeGraphData.nodes.map((node) => [node.id, node]));
        if (!patientNodeId || !nodeById.has(patientNodeId)) return new Set<string>();

        const ids = new Set<string>([patientNodeId]);
        const clinicalArtifactIds = new Set<string>();
        completeGraphData.links.forEach((link) => {
            const sourceId = getEndpointId(link.source);
            const targetId = getEndpointId(link.target);
            if (!sourceId || !targetId) return;
            const neighborId = sourceId === patientNodeId
                ? targetId
                : targetId === patientNodeId
                    ? sourceId
                    : "";
            if (!neighborId) return;
            ids.add(neighborId);
            const neighbor = nodeById.get(neighborId);
            if (neighbor?.type === "note" || neighbor?.type === "flow" || neighbor?.type === "evidence") clinicalArtifactIds.add(neighborId);
        });
        completeGraphData.links.forEach((link) => {
            const sourceId = getEndpointId(link.source);
            const targetId = getEndpointId(link.target);
            if (!sourceId || !targetId) return;
            const tagId = clinicalArtifactIds.has(sourceId) && nodeById.get(targetId)?.type === "tag"
                ? targetId
                : clinicalArtifactIds.has(targetId) && nodeById.get(sourceId)?.type === "tag"
                    ? sourceId
                    : "";
            if (tagId) ids.add(tagId);
        });
        return ids;
    }, [completeGraphData.links, completeGraphData.nodes, neuroViewScope, requestedNodeIds, synapseDirective?.focusNodeId, synapsePatientId]);
    const targetGraphData = useMemo(() => {
        if (!scopedNodeIds) return completeGraphData;
        return {
            nodes: completeGraphData.nodes.filter((node) => scopedNodeIds.has(node.id)),
            links: completeGraphData.links.filter((link) => {
                const sourceId = getEndpointId(link.source);
                const targetId = getEndpointId(link.target);
                return Boolean(sourceId && targetId && scopedNodeIds.has(sourceId) && scopedNodeIds.has(targetId));
            }),
        };
    }, [completeGraphData, scopedNodeIds]);
    const emphasizedNodeIds = useMemo(() => {
        const visibleIds = new Set(targetGraphData.nodes.map((node) => node.id));
        const emphasis = neuroViewScope === "patient" ? visibleIds : new Set(requestedNodeIds.filter((id) => visibleIds.has(id)));
        if (synapseDirective?.focusNodeId && visibleIds.has(synapseDirective.focusNodeId)) {
            emphasis.add(synapseDirective.focusNodeId);
        }
        return emphasis;
    }, [neuroViewScope, requestedNodeIds, synapseDirective?.focusNodeId, targetGraphData.nodes]);
    const spatialPatientNodeId = synapsePatientId ? `pat-${synapsePatientId}` : null;
    const spatialEmphasizedNodeIds = useMemo(() => {
        if (neuroViewScope !== "patient" || !spatialPatientNodeId) return emphasizedNodeIds;
        const visibleIds = new Set(targetGraphData.nodes.map((node) => node.id));
        return visibleIds.has(spatialPatientNodeId)
            ? new Set([spatialPatientNodeId])
            : new Set<string>();
    }, [emphasizedNodeIds, neuroViewScope, spatialPatientNodeId, targetGraphData.nodes]);
    const spatialFocusNodeId = synapseDirective?.focusNodeId
        || (neuroViewScope === "patient" ? spatialPatientNodeId : null);
    const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });

    // 3. UI State
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [selectedNote, setSelectedNote] = useState<PersonalNote | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [selectedEvidence, setSelectedEvidence] = useState<EvidenceNode | null>(null);
    const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
    const [isPatientSidebarOpen, setIsPatientSidebarOpen] = useState(true);

    useEffect(() => {
        const syncFullscreenState = () => {
            setIsFullscreen(document.fullscreenElement === containerRef.current);
        };
        document.addEventListener("fullscreenchange", syncFullscreenState);
        return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
    }, []);

    useEffect(() => {
        const targetNodeIds = new Set(targetGraphData.nodes.map((node) => node.id));
        const targetLinkKeys = new Set(targetGraphData.links.map(getLinkKey));

        setGraphData((previous) => {
            const previousNodes = new Map(previous.nodes.map((node) => [node.id, node]));
            const previousLinks = new Map(previous.links.map((link) => [getLinkKey(link), link]));

            const mergedNodes = targetGraphData.nodes.map((node) => {
                const previousNode = previousNodes.get(node.id);

                if (!previousNode) {
                    return {
                        ...node,
                        currentRadius: 0,
                        currentGlow: 0,
                        currentOpacity: 0,
                        revealProgress: 0,
                        revealTarget: 1,
                        bloomIntensity: 0.75,
                        dragPulse: 0,
                    };
                }

                return {
                    ...node,
                    x: previousNode.x,
                    y: previousNode.y,
                    fx: previousNode.fx,
                    fy: previousNode.fy,
                    currentRadius: previousNode.currentRadius,
                    currentGlow: previousNode.currentGlow,
                    currentOpacity: previousNode.currentOpacity,
                    revealProgress: previousNode.revealProgress ?? 1,
                    revealTarget: 1,
                    bloomIntensity: previousNode.bloomIntensity ?? 0,
                    dragPulse: previousNode.dragPulse ?? 0,
                    vx: (previousNode as any).vx,
                    vy: (previousNode as any).vy,
                } as GraphNode;
            });

            previous.nodes.forEach((node) => {
                if (targetNodeIds.has(node.id)) return;
                mergedNodes.push({
                    ...node,
                    revealTarget: 0,
                    bloomIntensity: 0,
                });
            });

            const nodeById = new Map(mergedNodes.map((node) => [node.id, node]));
            const mergedLinks: GraphLink[] = [];

            targetGraphData.links.forEach((link) => {
                const sourceId = getEndpointId(link.source);
                const targetId = getEndpointId(link.target);
                if (!sourceId || !targetId) return;

                const source = nodeById.get(sourceId);
                const target = nodeById.get(targetId);
                if (!source || !target) return;

                const previousLink = previousLinks.get(getLinkKey(link));
                mergedLinks.push({
                    ...link,
                    source,
                    target,
                    currentOpacity: previousLink?.currentOpacity ?? 0,
                    currentWidth: previousLink?.currentWidth ?? 0,
                    revealProgress: previousLink?.revealProgress ?? 0,
                    revealTarget: 1,
                    pulseSeed: link.pulseSeed ?? previousLink?.pulseSeed,
                });
            });

            previous.links.forEach((link) => {
                const key = getLinkKey(link);
                if (targetLinkKeys.has(key)) return;

                const sourceId = getEndpointId(link.source);
                const targetId = getEndpointId(link.target);
                const source = sourceId ? nodeById.get(sourceId) : null;
                const target = targetId ? nodeById.get(targetId) : null;
                if (!source || !target) return;

                mergedLinks.push({
                    ...link,
                    source,
                    target,
                    revealTarget: 0,
                });
            });

            mergedNodes.forEach((node) => {
                node.neighbors = [];
                node.links = [];
            });

            mergedLinks.forEach((link) => {
                const source = link.source as GraphNode;
                const target = link.target as GraphNode;
                if (!source || !target || typeof source === "string" || typeof target === "string") return;

                if ((link.revealTarget ?? 1) > 0) {
                    source.neighbors?.push(target);
                    target.neighbors?.push(source);
                    source.links?.push(link);
                    target.links?.push(link);
                }
            });

            return { nodes: mergedNodes, links: mergedLinks };
        });

        const cleanup = window.setTimeout(() => {
            setGraphData((current) => ({
                nodes: current.nodes.filter((node) => targetNodeIds.has(node.id) || (node.revealProgress ?? 1) > 0.08),
                links: current.links.filter((link) => targetLinkKeys.has(getLinkKey(link)) || (link.revealProgress ?? 1) > 0.08),
            }));
        }, 760);

        return () => window.clearTimeout(cleanup);
    }, [targetGraphData]);

    const nodeMap = useMemo(() => {
        return graphData.nodes.reduce<Record<string, GraphNode>>((acc, node) => {
            acc[node.id] = node;
            return acc;
        }, {});
    }, [graphData.nodes]);

    const spatialGraphData = useMemo(() => {
        const visibleIds = new Set(targetGraphData.nodes.map((node) => node.id));
        const constrainedPatientNodeId = spatialPatientNodeId
            && (neuroViewScope === "patient" || neuroViewScope === "subgraph")
            && completeGraphData.nodes.some((node) => node.id === spatialPatientNodeId)
            ? spatialPatientNodeId
            : null;
        const highlightContext = buildHoverEquivalentHighlight(
            completeGraphData,
            spatialEmphasizedNodeIds,
            constrainedPatientNodeId,
        );
        highlightContext.nodeIds.forEach((nodeId) => visibleIds.add(nodeId));
        const animatedNodeById = new Map(graphData.nodes.map((node) => [node.id, node]));
        return {
            nodes: completeGraphData.nodes
                .filter((node) => visibleIds.has(node.id))
                .map((node) => animatedNodeById.get(node.id) || node),
            links: completeGraphData.links.filter((link) => {
                const sourceId = getEndpointId(link.source);
                const targetId = getEndpointId(link.target);
                return Boolean(sourceId && targetId && visibleIds.has(sourceId) && visibleIds.has(targetId));
            }),
        };
    }, [completeGraphData, graphData.nodes, neuroViewScope, spatialEmphasizedNodeIds, spatialPatientNodeId, targetGraphData.nodes]);

    const activeFocusNodeId = useMemo(() => {
        if (synapseDirective?.focusNodeId) return synapseDirective.focusNodeId;
        if (activeEvent?.event_type === "focus_node") return String(activeEvent.payload.nodeId || "");
        if (activeEvent?.event_type === "focus_link") {
            return String(activeEvent.payload.target || activeEvent.payload.source || "");
        }
        return eventsLoaded ? traceNodeIds[0] || "" : "";
    }, [activeEvent, eventsLoaded, synapseDirective?.focusNodeId, traceNodeIds]);
    const traceHoverNode = activeFocusNodeId ? nodeMap[activeFocusNodeId] || null : null;
    const effectiveHoverNode = hoverNode || traceHoverNode;
    useEffect(() => {
        if (!traceHoverNode || !graphRef.current) return;
        const x = Number(traceHoverNode.x);
        const y = Number(traceHoverNode.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        graphRef.current.centerAt(x, y, shouldReduceMotion ? 0 : 520);
        if (!shouldReduceMotion) graphRef.current.zoom(1.42, 520);
    }, [shouldReduceMotion, traceHoverNode]);

    useEffect(() => {
        if (!synapseDirective?.mode) return;
        setIsUniverseMode(synapseDirective.mode === "3d");
    }, [synapseDirective]);

    useEffect(() => {
        if (synapseDirective) setSearchQuery("");
    }, [synapseDirective]);

    useEffect(() => {
        if (isUniverseMode || !graphRef.current || !targetGraphData.nodes.length) return;
        const timeout = window.setTimeout(() => {
            graphRef.current?.d3ReheatSimulation();
            graphRef.current?.zoomToFit(shouldReduceMotion ? 0 : 520, 80);
        }, shouldReduceMotion ? 0 : 90);
        return () => window.clearTimeout(timeout);
    }, [isUniverseMode, neuroViewScope, shouldReduceMotion, synapseDirective?.nodeIds, synapsePatientId, targetGraphData.nodes.length]);

    useEffect(() => {
        if (isLoading || !graphSize.width || !graphSize.height) return;
        window.dispatchEvent(new CustomEvent("synapse:surface-ready", {
            detail: { target: "neuroview-graph", runId: synapseRunId || null, scope: neuroViewScope, mode: isUniverseMode ? "3d" : "2d" },
        }));
    }, [graphSize.height, graphSize.width, isLoading, isUniverseMode, neuroViewScope, synapseRunId]);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const updateGraphSize = () => {
            const rect = element.getBoundingClientRect();
            setGraphSize({
                width: Math.max(320, Math.floor(rect.width)),
                height: Math.max(320, Math.floor(rect.height)),
            });
        };

        updateGraphSize();

        const resizeObserver = new ResizeObserver(updateGraphSize);
        resizeObserver.observe(element);
        window.addEventListener("resize", updateGraphSize);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", updateGraphSize);
        };
    }, []);

    useEffect(() => {
        return () => {
            animationTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
            animationTimeoutsRef.current = [];
        };
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(NEUROVIEW_2D_CONFIG_STORAGE_KEY, JSON.stringify(config));
        } catch {
            // Storage can be unavailable in private/restricted browser contexts.
        }
    }, [config]);

    // 4. Animation Loop
    useEffect(() => {
        if (isUniverseMode) return;
        const animate = () => {
            timeRef.current = shouldReduceMotion ? 0 : timeRef.current + 0.016;
            const lerpFactor = shouldReduceMotion ? 1 : 0.15;

            graphData.nodes.forEach((n) => {
                const baseRadius = n.type === 'patient' ? 6 : (n.type === 'flow' ? 5.2 : (n.type === 'note' ? 4.2 : 2.8));
                const baseGlow = n.type === 'patient' ? 26 : (n.type === 'flow' ? 22 : (n.type === 'note' ? 18 : 12));

                // Determine targets based on hover state
                let targetRadius = baseRadius;
                let targetGlow = baseGlow;

                if (effectiveHoverNode && n.id === effectiveHoverNode.id) {
                    targetRadius = baseRadius * 1.8;
                    targetGlow = baseGlow * 2.5;
                } else if (effectiveHoverNode && effectiveHoverNode.neighbors?.includes(n)) {
                    targetRadius = baseRadius * 1.3;
                    targetGlow = baseGlow * 1.5;
                }

                // Breathing effect
                const breathe = shouldReduceMotion ? 0 : Math.sin(timeRef.current * 2 + (n.id.charCodeAt(0) * 0.1)) * 0.1;

                n.currentRadius = lerp(n.currentRadius || baseRadius, targetRadius * (1 + breathe * 0.1), lerpFactor);
                n.currentGlow = lerp(n.currentGlow || baseGlow, targetGlow * (1 + breathe * 0.2), lerpFactor);
                n.revealProgress = shouldReduceMotion ? (n.revealTarget ?? 1) : lerp(n.revealProgress ?? 1, n.revealTarget ?? 1, 0.12);
                n.bloomIntensity = shouldReduceMotion ? 0 : lerp(n.bloomIntensity ?? 0, 0, 0.08);
                n.dragPulse = shouldReduceMotion ? 0 : lerp(n.dragPulse ?? 0, 0, 0.1);
            });

            graphData.links.forEach((l) => {
                l.revealProgress = shouldReduceMotion ? (l.revealTarget ?? 1) : lerp(l.revealProgress ?? 1, l.revealTarget ?? 1, 0.12);
            });

            (graphRef.current as any)?.refresh?.();
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [effectiveHoverNode, graphData.links, graphData.nodes, isUniverseMode, shouldReduceMotion]);

    // 5. Interaction Handlers
    const handleNodeClick = useCallback((node: GraphNode) => {
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;

        // Smooth camera transition
        graphRef.current?.centerAt(node.x!, node.y!, shouldReduceMotion ? 0 : 800);
        graphRef.current?.zoom(3.5, shouldReduceMotion ? 0 : 1000);

        if (node.type === 'patient') {
            setSelectedPatient(node.data);
            setSelectedNote(null);
            setSelectedEvidence(null);
        } else if (node.type === 'note') {
            setSelectedNote(node.data);
            setSelectedPatient(null);
            setSelectedEvidence(null);
        } else if (node.type === 'flow') {
            setSelectedNote(null);
            setSelectedPatient(null);
            setSelectedEvidence(null);
            window.dispatchEvent(new CustomEvent("neuroflow:navigate", {
                detail: { flowId: node.data?.id },
            }));
        } else if (node.type === 'evidence' && node.data?.evidence) {
            setSelectedEvidence(node.data.evidence as EvidenceNode);
            setSelectedNote(null);
            setSelectedPatient(null);
        }
    }, [shouldReduceMotion]);

    const handleEnterNeuroView3D = useCallback(() => {
        const capability = detectNeuroViewHardware(Boolean(shouldReduceMotion));
        setNeuroView3DCapability(capability);
        if (!capability.available) {
            setWebglFallbackMessage("O WebGL não está disponível nesta máquina. O NeuroView plano foi preservado.");
            return;
        }
        setWebglFallbackMessage(null);
        setSelectedEvidence(null);
        setIsUniverseMode(true);
    }, [shouldReduceMotion]);

    const handle3DSelectNote = useCallback((note: PersonalNote) => {
        setSelectedNote(note);
        setSelectedPatient(null);
    }, []);

    const handle3DSelectPatient = useCallback((patient: Patient) => {
        setSelectedPatient(patient);
        setSelectedNote(null);
    }, []);

    const handle3DClearPatient = useCallback(() => {
        setSelectedPatient(null);
    }, []);

    const handle3DCloseDetails = useCallback(() => {
        setSelectedNote(null);
        setSelectedPatient(null);
    }, []);

    const handleExitNeuroView3D = useCallback(() => {
        setSelectedNote(null);
        setSelectedPatient(null);
        setIsUniverseMode(false);
    }, []);

    const handleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false));
        }
    };

    const handleAnimate = useCallback(() => {
        if (!graphRef.current) return;
        const fg = graphRef.current;
        const getEndpointId = (endpoint: GraphLink["source"] | GraphLink["target"]) => (
            typeof endpoint === "string" ? endpoint : endpoint?.id
        );

        animationTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
        animationTimeoutsRef.current = [];

        if (shouldReduceMotion) {
            graphData.nodes.forEach((n) => {
                n.currentOpacity = 1;
                n.revealProgress = 1;
                n.revealTarget = 1;
                n.bloomIntensity = 0;
                n.dragPulse = 0;
            });
            graphData.links.forEach((l) => {
                l.currentOpacity = 1;
                l.currentWidth = Math.max(l.currentWidth || 0, 0.6);
                l.revealProgress = 1;
                l.revealTarget = 1;
            });
            fg.d3ReheatSimulation();
            fg.zoomToFit(0, 80);
            return;
        }

        const adjacency = new Map<string, string[]>();
        graphData.nodes.forEach((node) => adjacency.set(node.id, []));
        graphData.links.forEach((link) => {
            const sourceId = getEndpointId(link.source);
            const targetId = getEndpointId(link.target);
            if (!sourceId || !targetId) return;

            adjacency.get(sourceId)?.push(targetId);
            adjacency.get(targetId)?.push(sourceId);
        });

        const delays = new Map<string, number>();
        const roots = graphData.nodes.filter((node) => node.type === "patient");
        const queue = (roots.length ? roots : graphData.nodes.slice(0, 1)).map((node) => ({ id: node.id, depth: 0 }));

        queue.forEach((item) => delays.set(item.id, 0));

        for (let index = 0; index < queue.length; index += 1) {
            const item = queue[index];
            adjacency.get(item.id)?.forEach((neighborId) => {
                if (delays.has(neighborId)) return;

                const seed = Array.from(neighborId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
                delays.set(neighborId, item.depth * 160 + 90 + (seed % 85));
                queue.push({ id: neighborId, depth: item.depth + 1 });
            });
        }

        // 1. Reset all to zero/hidden state
        graphData.nodes.forEach((n) => {
            const baseRadius = n.type === 'patient' ? 6 : (n.type === 'flow' ? 5.2 : (n.type === 'note' ? 4.2 : 2.8));
            const baseGlow = n.type === 'patient' ? 26 : (n.type === 'flow' ? 22 : (n.type === 'note' ? 18 : 12));

            n.currentRadius = 0;
            n.currentGlow = 0;
            n.currentOpacity = 0;
            n.revealProgress = 0;
            n.revealTarget = 0;
            n.bloomIntensity = 0;
            n.dragPulse = 0;
            n.targetRadius = baseRadius;
            n.targetGlow = baseGlow;
        });
        graphData.links.forEach((l) => {
            l.currentOpacity = 0;
            l.currentWidth = 0;
            l.revealProgress = 0;
            l.revealTarget = 0;
        });

        graphData.nodes.forEach((n, index) => {
            const delay = delays.get(n.id) ?? (index * 70);
            const baseRadius = n.type === 'patient' ? 6 : (n.type === 'flow' ? 5.2 : (n.type === 'note' ? 4.2 : 2.8));
            const baseGlow = n.type === 'patient' ? 26 : (n.type === 'flow' ? 22 : (n.type === 'note' ? 18 : 12));

            const timeout = setTimeout(() => {
                const angle = ((n.pulseSeed || index * 97) % 360) * (Math.PI / 180);

                n.currentRadius = baseRadius * 0.28;
                n.currentGlow = baseGlow * 0.4;
                n.currentOpacity = 0.15;
                n.revealTarget = 1;
                n.bloomIntensity = 1;

                (n as any).vx = ((n as any).vx || 0) + Math.cos(angle) * (n.type === "patient" ? 1.1 : 2.4);
                (n as any).vy = ((n as any).vy || 0) + Math.sin(angle) * (n.type === "patient" ? 1.1 : 2.4);

                fg.d3ReheatSimulation();
            }, delay);

            animationTimeoutsRef.current.push(timeout);
        });

        graphData.links.forEach((l, index) => {
            const sourceId = getEndpointId(l.source);
            const targetId = getEndpointId(l.target);
            const linkDelay = Math.max(delays.get(sourceId || "") ?? 0, delays.get(targetId || "") ?? 0) + 130 + (index % 8) * 18;

            const timeout = setTimeout(() => {
                l.revealTarget = 1;
                l.currentOpacity = 0.05;
                l.currentWidth = 0.2;
            }, linkDelay);

            animationTimeoutsRef.current.push(timeout);
        });

        const finalDelay = Math.max(800, ...Array.from(delays.values())) + 500;
        const finalTimeout = setTimeout(() => {
            fg.d3ReheatSimulation();
            fg.zoomToFit(900, 80);
        }, finalDelay);

        animationTimeoutsRef.current.push(finalTimeout);

    }, [graphData, shouldReduceMotion]);


    const patientNotes = useMemo(() => {
        if (!selectedPatient || !notes) return [];
        return notes.filter(n => n.patient_id === selectedPatient.id);
    }, [selectedPatient, notes]);

    // Apply physics configuration updates
    useEffect(() => {
        if (graphRef.current) {
            const fg = graphRef.current;

            const charge = fg.d3Force('charge');
            if (charge) {
                (charge as any)
                    .strength((node: any) => {
                        if (node.type === "patient") return config.repulsion * 1.05;
                        if (node.type === "tag") return config.repulsion * 0.42;
                        if (node.type === "flow") return config.repulsion * 0.9;
                        return config.repulsion * 0.82;
                    })
                    .distanceMin(18)
                    .distanceMax(560);
            }

            const link = fg.d3Force('link');
            if (link) {
                (link as any)
                    .distance((l: any) => config.linkDistance * ((l.value || 1) >= 2 ? 1.15 : 0.72))
                    .strength((l: any) => ((l.value || 1) >= 2 ? 0.32 : 0.22))
                    .iterations(2);
            }

            // Radial forces for centering
            fg.d3Force('x', forceX(0).strength(config.centerForce * 0.22));
            fg.d3Force('y', forceY(0).strength(config.centerForce * 0.22));
            fg.d3Force('radial', forceRadial((node: any) => {
                if (node.type === "patient") return 72;
                const evidenceDensity = Number(node.data?.evidence?.gravity?.score);
                if (Number.isFinite(evidenceDensity)) return 112 + (1 - evidenceDensity) * 108;
                if (node.type === "flow") return 132;
                if (node.type === "note") return 165;
                return 240;
            }).strength(config.centerForce * 0.055));

            // Collision to prevent overlap
            fg.d3Force('collide', forceCollide((node: any) => {
                const radius = node.type === 'patient' ? 15 : (node.type === 'flow' ? 12 : (node.type === 'note' ? 10 : (node.type === 'evidence' ? 8 : 7)));
                return radius + Math.max(0, node.currentRadius || 0);
            }).strength(0.66).iterations(2));

            fg.d3ReheatSimulation();
        }
    }, [config, graphData]);

    // Canvas Objects Handlers
    const handleNodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        drawNode(node as GraphNode, ctx, globalScale, effectiveHoverNode, isDarkMode, timeRef.current, config.performanceMode, emphasizedNodeIds);
    }, [effectiveHoverNode, emphasizedNodeIds, isDarkMode, config.performanceMode]);

    const handleLinkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        drawLink(link as GraphLink, ctx, globalScale, effectiveHoverNode, isDarkMode, timeRef.current, config.performanceMode, emphasizedNodeIds);
    }, [effectiveHoverNode, emphasizedNodeIds, isDarkMode, config.performanceMode]);

    return (
        <div
            ref={containerRef}
            className="group/canvas relative isolate h-full min-h-0 w-full min-w-0 overflow-hidden bg-transparent [contain:layout_paint_size] [.light_&]:bg-transparent"
            data-synapse-target="neuroview-graph"
            data-synapse-ready={isLoading ? undefined : "true"}
            data-synapse-run-id={synapseRunId || undefined}
            data-synapse-patient-id={synapsePatientId || undefined}
            data-synapse-neuroview-scope={neuroViewScope}
            data-synapse-neuroview-mode={isUniverseMode ? "3d" : "2d"}
        >

            {/* Cinematic Background */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 notes-neuroview-backdrop" />
                <div className="absolute inset-0 notes-retina-texture opacity-[0.2] dark:opacity-[0.28]" />
            </div>

            <NeuroViewControls
                config={config}
                onConfigChange={setConfig}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                isFullscreen={isFullscreen}
                onToggleFullscreen={handleFullscreen}
                onZoomIn={() => graphRef.current?.zoom(graphRef.current.zoom() * 1.3, 400)}
                onZoomOut={() => graphRef.current?.zoom(graphRef.current.zoom() / 1.3, 400)}
                onCenter={() => graphRef.current?.zoomToFit(400)}
                onAnimate={handleAnimate}
            />

            <NeuroViewSidebar
                patients={patients || []}
                isOpen={isPatientSidebarOpen}
                onOpenChange={setIsPatientSidebarOpen}
                onHoverNode={(id) => id && nodeMap[id] ? setHoverNode(nodeMap[id]) : setHoverNode(null)}
                onSelectPatient={(p) => {
                    const id = `pat-${p.id}`;
                    if (nodeMap[id]) handleNodeClick(nodeMap[id]);
                }}
            />

            {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 dark:bg-black/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-8 h-8 animate-spin text-primary dark:text-white" />
                        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 dark:text-white/60 animate-pulse">Sincronizando Sinapses...</p>
                    </div>
                </div>
            )}

            {!isUniverseMode ? (
                <div className="absolute inset-0 z-10 overflow-hidden">
                    <ForceGraph2D
                    ref={graphRef}
                    graphData={graphData}
                    width={Math.max(1, graphSize.width)}
                    height={Math.max(1, graphSize.height)}
                    nodeLabel={() => ""}
                    nodeColor={() => "transparent"}
                    nodeCanvasObject={handleNodeCanvasObject}
                    nodeRelSize={4}
                    linkColor={() => "transparent"}
                    linkCanvasObject={handleLinkCanvasObject}
                    linkDirectionalParticles={!shouldReduceMotion && effectiveHoverNode ? 2 : 0}
                    linkDirectionalParticleWidth={1}
                    linkDirectionalParticleSpeed={0.003}
                    linkDirectionalParticleColor={() => "rgba(255, 255, 255, 0.48)"}
                    backgroundColor="transparent"
                    onNodeClick={(node) => handleNodeClick(node as GraphNode)}
                    onNodeHover={(node) => setHoverNode((node as GraphNode) || null)}
                    onNodeDrag={(node) => {
                        const graphNode = node as GraphNode;
                        graphNode.dragPulse = 1;
                        graphNode.currentGlow = Math.max(graphNode.currentGlow || 0, graphNode.type === "patient" ? 34 : 24);
                        setHoverNode(graphNode);
                    }}
                    onNodeDragEnd={(node) => {
                        const graphNode = node as GraphNode;
                        graphNode.dragPulse = 0.65;
                        (graphNode as any).vx = ((graphNode as any).vx || 0) * 0.16;
                        (graphNode as any).vy = ((graphNode as any).vy || 0) * 0.16;
                        setHoverNode(null);
                    }}
                    autoPauseRedraw={false}
                    d3AlphaDecay={0.016}
                    d3VelocityDecay={0.39}
                    cooldownTicks={260}
                    warmupTicks={110}
                    onEngineStop={() => graphRef.current?.zoomToFit(shouldReduceMotion ? 0 : 600, 80)}
                    />
                </div>
            ) : null}

            <GraphDetailsPanel
                selectedNote={selectedNote}
                selectedPatient={selectedPatient}
                selectedEvidence={selectedEvidence}
                onCloseNote={() => setSelectedNote(null)}
                onClosePatient={() => setSelectedPatient(null)}
                onCloseEvidence={() => setSelectedEvidence(null)}
                onDeleteNote={(id) => { deleteNote(id); setSelectedNote(null); }}
                onUpdateNote={(id, updates) => updateNote({ id, updates })}
                onSelectNote={(note) => { setSelectedNote(note); setSelectedPatient(null); }}
                patientNotes={patientNotes}
                patients={patients}
            />

            {!isUniverseMode && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleEnterNeuroView3D}
                    className="absolute right-5 top-5 z-40 min-h-11 rounded-[18px] border border-white/[0.1] bg-white/[0.075] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/72 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-3xl transition-all duration-500 hover:-translate-y-0.5 hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 [.light_&]:border-black/[0.08] [.light_&]:bg-white/72 [.light_&]:text-zinc-700 [.light_&]:shadow-[0_22px_64px_-38px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.65)] [.light_&]:hover:bg-white [.light_&]:hover:text-zinc-950 [.light_&]:focus-visible:ring-zinc-950/35 [.light_&]:focus-visible:ring-offset-white"
                    aria-label="Abrir NeuroView 3d"
                >
                    NeuroView 3d
                </Button>
            )}

            {!isUniverseMode && webglFallbackMessage ? (
                <div
                    role="status"
                    className="absolute right-5 top-[74px] z-40 max-w-xs rounded-2xl border border-border/20 bg-background/88 px-4 py-3 text-xs text-muted-foreground shadow-xl backdrop-blur-xl"
                >
                    {webglFallbackMessage}
                </div>
            ) : null}

            {/* NeuroView 3d is intentionally lazy-loaded only after entering the spatial scene. */}
            {isUniverseMode && (
                <div className="absolute inset-0 z-[60]">
                    <Suspense
                        fallback={(
                            <div className="absolute inset-0 flex items-center justify-center bg-background/96 backdrop-blur-xl">
                                <div className="flex flex-col items-center gap-3" role="status">
                                    <Loader2 className="h-7 w-7 animate-spin text-foreground motion-reduce:animate-none" />
                                    <p className="text-xs font-semibold tracking-wide text-muted-foreground">Preparando NeuroView 3d…</p>
                                </div>
                            </div>
                        )}
                    >
                        <NeuroView3D
                            onBack={handleExitNeuroView3D}
                            graphData={spatialGraphData}
                            darkMode={isDarkMode}
                            profile={neuroView3DCapability?.profile || "light"}
                            reducedMotion={Boolean(shouldReduceMotion)}
                            isFullscreen={isFullscreen}
                            onToggleFullscreen={handleFullscreen}
                            emphasizedNodeIds={spatialEmphasizedNodeIds}
                            focusNodeId={spatialFocusNodeId}
                            detailsOpen={Boolean(selectedNote || selectedPatient)}
                            onCloseDetails={handle3DCloseDetails}
                            onSelectNote={handle3DSelectNote}
                            onSelectPatient={handle3DSelectPatient}
                            onClearPatient={handle3DClearPatient}
                            evidence={evidence}
                            evidenceAvailable={isEvidenceAvailable}
                            onUpdateEvidenceOverride={updateEvidenceOverride}
                        />
                    </Suspense>
                </div>
            )}
        </div>
    );
};
