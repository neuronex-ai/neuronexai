import { useMemo, useRef, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { usePersonalNotes } from "@/hooks/use-personal-notes";
import { usePatients } from "@/hooks/use-patients";
import { supabase } from "@/integrations/supabase/client";
import { parseStoredNeuroFlowWorkflow } from "@/lib/neuroflow-workflow";
import { GraphNode, GraphLink, GRAPH_COLORS } from "./graph-types";
import { NeuroConfig } from "../NeuroViewControls";
import { useNeuroVisionEvidence } from "../clinical-evidence/use-neuroview-evidence";
import { buildAttentionReasons, buildPatientAttentionSummary } from "../clinical-evidence/evidence-model";

interface UseGraphDataProps {
  config: NeuroConfig;
  searchQuery: string;
  trackNodePositions?: boolean;
}

const normalizeSearchText = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const useGraphData = ({ config, searchQuery, trackNodePositions = true }: UseGraphDataProps) => {
  const { user } = useAuth();
  const { notes, isLoading: loadingNotes } = usePersonalNotes();
  const { data: patients, isLoading: loadingPatients } = usePatients();
  const {
    evidence,
    isAvailable: isEvidenceAvailable,
    isLoading: loadingEvidence,
    updateOverride: updateEvidenceOverride,
  } = useNeuroVisionEvidence();
  const [flows, setFlows] = useState<any[]>([]);
  const [loadingFlows, setLoadingFlows] = useState(false);
  
  // Cache images and previous node positions
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const nodePositions = useRef<Record<string, { x: number, y: number, vx: number, vy: number }>>({});

  useEffect(() => {
    if (!user?.id) {
      setFlows([]);
      return;
    }

    let isMounted = true;
    setLoadingFlows(true);

    const fetchFlows = async () => {
      const { data, error } = await supabase
        .from("neuro_flows")
        .select("id,title,description,tags,is_template,patient_id,workflow,updated_at,created_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (!isMounted) return;
      if (error) {
        console.error("[NeuroVision] Falha ao carregar fluxos:", error);
        setFlows([]);
      } else {
        setFlows(data || []);
      }
      setLoadingFlows(false);
    };

    void fetchFlows();

    const channel = supabase
      .channel(`public:neuro_flows_graph_${user.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "neuro_flows", filter: `user_id=eq.${user.id}` },
        () => void fetchFlows()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const { graphData, nodeMap } = useMemo(() => {
    if (!notes || !patients) {
        return { graphData: { nodes: [], links: [] }, nodeMap: {} };
    }

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const map: Record<string, GraphNode> = {};
    const addedIds = new Set<string>();

    const getOrLoadImage = (url: string) => {
      if (!imagesRef.current[url]) {
        const img = new Image();
        img.src = url;
        img.crossOrigin = "Anonymous";
        imagesRef.current[url] = img;
      }
      return imagesRef.current[url];
    };

    // Helper to restore position
    const enhanceNode = (n: GraphNode) => {
        const prev = nodePositions.current[n.id];
        if (prev) {
            n.x = prev.x;
            n.y = prev.y;
            // Also restore velocity to prevent sudden stops
            (n as any).vx = prev.vx;
            (n as any).vy = prev.vy;
        }
        return n;
    };

    const addNode = (n: any) => {
      if (n.type === 'patient' && !config.showPatients) return;
      if (n.type === 'note' && !config.showNotes) return;
      if (n.type === 'tag' && !config.showTags) return;
      if (n.type === 'flow' && !config.showNotes) return;
      if (n.type === 'evidence' && !config.showNotes) return;

      const evidenceDensity = Number(n.data?.evidence?.gravity?.density);
      const densityScale = Number.isFinite(evidenceDensity) ? 0.82 + evidenceDensity * 0.36 : 1;
      const baseRadius = (n.type === 'patient' ? 6 : (n.type === 'flow' ? 5.2 : (n.type === 'note' ? 4.2 : (n.type === 'evidence' ? 3.5 : 2.8)))) * densityScale;
      const baseGlow = n.type === 'patient' ? 24 : (n.type === 'flow' ? 22 : (n.type === 'note' ? 16 : (n.type === 'evidence' ? 14 : 10)));
      const pulseSeed = Array.from(String(n.id)).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 997;

      const node: GraphNode = {
        ...n,
        val: n.type === 'patient' ? 22 : (n.type === 'flow' ? 15 : (n.type === 'note' ? 11 : (n.type === 'evidence' ? 8 : 5))),
        neighbors: [],
        links: [],
        imgObj: n.imgUrl ? getOrLoadImage(n.imgUrl) : undefined,
        currentRadius: baseRadius,
        targetRadius: baseRadius,
        currentGlow: baseGlow,
        targetGlow: baseGlow,
        revealProgress: 1,
        revealTarget: 1,
        pulseSeed
      };

      nodes.push(enhanceNode(node));
      addedIds.add(n.id);
      map[n.id] = node;
    };

    const normalizedSearch = normalizeSearchText(searchQuery.trim());
    const matchedPatientIds = new Set<string>();
    const hiddenEvidenceKeys = new Set(
      evidence.filter((item) => item.hidden).map((item) => `${item.sourceType}:${item.sourceId}`),
    );

    patients.forEach((patient) => {
      if (!normalizedSearch || normalizeSearchText(patient.name).includes(normalizedSearch)) {
        matchedPatientIds.add(patient.id);
      }
    });

    const visibleNotes = notes.filter(n => {
      if (hiddenEvidenceKeys.has(`personal_note:${n.id}`)) return false;
      if (!normalizedSearch) return true;

      const patient = n.patient_id ? patients.find(p => p.id === n.patient_id) : null;
      return normalizeSearchText(n.title).includes(normalizedSearch) ||
        normalizeSearchText(n.content).includes(normalizedSearch) ||
        n.tags?.some((tag: string) => normalizeSearchText(tag).includes(normalizedSearch)) ||
        Boolean(normalizeSearchText(patient?.name).includes(normalizedSearch));
    });

    const visibleFlows = flows.filter(flow => {
      if (hiddenEvidenceKeys.has(`flow:${flow.id}`)) return false;
      if (!normalizedSearch) return true;

      const patient = flow.patient_id ? patients.find(p => p.id === flow.patient_id) : null;
      return normalizeSearchText(flow.title).includes(normalizedSearch) ||
        normalizeSearchText(flow.description).includes(normalizedSearch) ||
        flow.tags?.some((tag: string) => normalizeSearchText(tag).includes(normalizedSearch)) ||
        Boolean(normalizeSearchText(patient?.name).includes(normalizedSearch));
    });

    const visibleEvidence = evidence.filter((item) => {
      if (item.hidden) return false;
      if (!normalizedSearch) return true;
      const patient = item.patientId ? patients.find((candidate) => candidate.id === item.patientId) : null;
      return normalizeSearchText(item.title).includes(normalizedSearch)
        || normalizeSearchText(item.theme).includes(normalizedSearch)
        || item.tags.some((tag) => normalizeSearchText(tag).includes(normalizedSearch))
        || Boolean(normalizeSearchText(patient?.name).includes(normalizedSearch));
    });

    const visiblePatientIds = new Set<string>(matchedPatientIds);
    visibleNotes.forEach((note) => {
      if (note.patient_id) visiblePatientIds.add(note.patient_id);
    });
    visibleFlows.forEach((flow) => {
      if (flow.patient_id) visiblePatientIds.add(flow.patient_id);
    });
    visibleEvidence.forEach((item) => {
      if (item.patientId) visiblePatientIds.add(item.patientId);
    });
    const attentionByPatientId = new Map(
      patients.map((patient) => [patient.id, buildAttentionReasons(patient, evidence)]),
    );
    const attentionSummaryByPatientId = new Map(
      patients.map((patient) => [patient.id, buildPatientAttentionSummary(patient.id, evidence)]),
    );

    // Add Patients
    patients.forEach(p => {
      if (normalizedSearch && !visiblePatientIds.has(p.id)) return;

      addNode({
        id: `pat-${p.id}`,
        label: p.name,
        type: 'patient',
        color: '#FFFFFF',
        imgUrl: p.avatar_url,
        data: {
          ...p,
          attentionReasons: attentionByPatientId.get(p.id) || [],
          attentionSummary: attentionSummaryByPatientId.get(p.id),
        }
      });
    });

    // Add Notes & Tags
    visibleNotes.forEach(n => {
      const noteId = `note-${n.id}`;

      addNode({
        id: noteId,
        label: n.title,
        type: 'note',
        color: GRAPH_COLORS.note,
        data: n
      });

      // Link Note -> Patient
      if (n.patient_id && addedIds.has(`pat-${n.patient_id}`) && addedIds.has(noteId)) {
        links.push({ source: `pat-${n.patient_id}`, target: noteId, value: 2, revealProgress: 1, revealTarget: 1 });
      }

      // Tags
      n.tags?.forEach((tag: string) => {
        const tagId = `tag-${tag}`;
        if (!addedIds.has(tagId)) {
          addNode({ id: tagId, label: `#${tag}`, type: 'tag', color: GRAPH_COLORS.tag });
        }
        if (addedIds.has(noteId) && addedIds.has(tagId)) {
          links.push({ source: noteId, target: tagId, value: 1, revealProgress: 1, revealTarget: 1 });
        }
      });
    });

    // Add NeuroFlow Studio artifacts
    visibleFlows.forEach(flow => {
      const flowId = `flow-${flow.id}`;
      const workflow = parseStoredNeuroFlowWorkflow(flow.workflow);

      addNode({
        id: flowId,
        label: flow.title,
        type: 'flow',
        color: GRAPH_COLORS.flow,
        data: { ...flow, origin: 'NeuroFlow' }
      });

      if (flow.patient_id && addedIds.has(`pat-${flow.patient_id}`) && addedIds.has(flowId)) {
        links.push({ source: `pat-${flow.patient_id}`, target: flowId, value: 2.6, revealProgress: 1, revealTarget: 1 });
      }

      flow.tags?.forEach((tag: string) => {
        const tagId = `tag-${tag}`;
        if (!addedIds.has(tagId)) {
          addNode({ id: tagId, label: `#${tag}`, type: 'tag', color: GRAPH_COLORS.tag });
        }
        if (addedIds.has(flowId) && addedIds.has(tagId)) {
          links.push({ source: flowId, target: tagId, value: 1, revealProgress: 1, revealTarget: 1 });
        }
      });

      workflow?.links
        .filter((link) => link.type === 'note')
        .forEach((link) => {
          const noteId = `note-${link.id}`;
          if (addedIds.has(flowId) && addedIds.has(noteId)) {
            links.push({ source: flowId, target: noteId, value: 1.8, revealProgress: 1, revealTarget: 1 });
          }
        });
    });

    visibleEvidence.forEach((item) => {
      const existingNodeId = item.sourceType === "personal_note"
        ? `note-${item.sourceId}`
        : item.sourceType === "flow"
          ? `flow-${item.sourceId}`
          : null;
      if (existingNodeId && map[existingNodeId]) {
        map[existingNodeId].data = { ...map[existingNodeId].data, evidence: item };
        const densityScale = 0.82 + item.gravity.density * 0.36;
        const originalRadius = map[existingNodeId].type === "flow" ? 5.2 : 4.2;
        map[existingNodeId].currentRadius = originalRadius * densityScale;
        map[existingNodeId].targetRadius = originalRadius * densityScale;
        return;
      }
      if (!item.patientId || !addedIds.has(`pat-${item.patientId}`)) return;

      const evidenceId = `evidence-${item.sourceType}-${item.sourceId}`;
      addNode({
        id: evidenceId,
        label: item.title,
        type: 'evidence',
        color: GRAPH_COLORS.evidence,
        data: {
          evidence: item,
          patient_id: item.patientId,
          updated_at: item.updatedAt,
          created_at: item.occurredAt,
        },
      });
      if (!addedIds.has(evidenceId)) return;
      links.push({
        source: `pat-${item.patientId}`,
        target: evidenceId,
        value: 1.2 + item.gravity.density * 1.5 + item.gravity.tension * 0.5,
        revealProgress: 1,
        revealTarget: 1,
      });
      item.tags.forEach((tag) => {
        const tagId = `tag-${tag}`;
        if (!addedIds.has(tagId)) {
          addNode({ id: tagId, label: `#${tag}`, type: 'tag', color: GRAPH_COLORS.tag });
        }
        if (addedIds.has(tagId)) {
          links.push({ source: evidenceId, target: tagId, value: 1, revealProgress: 1, revealTarget: 1 });
        }
      });
    });

    // Compute Neighbors for highlighting logic
    links.forEach(link => {
      const a = map[link.source as string];
      const b = map[link.target as string];
      if (a && b) {
        link.pulseSeed = ((a.pulseSeed || 0) + (b.pulseSeed || 0)) % 997;
        a.neighbors?.push(b);
        b.neighbors?.push(a);
        a.links?.push(link);
        b.links?.push(link);
      }
    });

    return { graphData: { nodes, links }, nodeMap: map };
  }, [notes, patients, flows, evidence, config, searchQuery]);

  // Continuously save positions to ref to persist across re-renders
  useEffect(() => {
     if (!trackNodePositions) return undefined;
     // We don't need a timer, just update on unmount or before re-render? 
     // Actually, graph library updates the node objects directly.
     // We need to capture that state periodically or before updates.
     const interval = setInterval(() => {
         graphData.nodes.forEach(n => {
             if (Number.isFinite(n.x) && Number.isFinite(n.y)) {
                 nodePositions.current[n.id] = { 
                     x: n.x!, 
                     y: n.y!, 
                     vx: (n as any).vx || 0,
                     vy: (n as any).vy || 0
                 };
             }
         });
     }, 500);
     return () => clearInterval(interval);
  }, [graphData, trackNodePositions]);

  return { 
    graphData, 
    nodeMap, 
    notes,
    patients,
    flows,
    evidence,
    isEvidenceAvailable,
    updateEvidenceOverride,
    isLoading: loadingNotes || loadingPatients || loadingFlows || loadingEvidence
  };
};
