import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { buildEvidenceNodes } from "./evidence-model";
import type {
  EvidenceIndexRow,
  EvidenceNode,
  EvidenceOverrideRow,
  EvidenceSource,
} from "./evidence-types";

type EvidenceOverrideUpdate = {
  sourceType: EvidenceSource;
  sourceId: string;
  priority?: number;
  isPinned?: boolean;
  isHidden?: boolean;
  themeOverride?: string | null;
};

const normalizeIndexRow = (row: Record<string, unknown>): EvidenceIndexRow => ({
  id: String(row.id),
  user_id: String(row.user_id),
  patient_id: row.patient_id ? String(row.patient_id) : null,
  source_type: row.source_type as EvidenceSource,
  source_id: String(row.source_id),
  occurred_at: String(row.occurred_at),
  updated_at: String(row.updated_at),
  title: String(row.title || "Sem título"),
  tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [],
  reviewed: Boolean(row.reviewed),
  is_actionable: Boolean(row.is_actionable),
  action_due_at: row.action_due_at ? String(row.action_due_at) : null,
  action_completed: Boolean(row.action_completed),
  metadata: row.metadata && typeof row.metadata === "object" ? row.metadata as EvidenceIndexRow["metadata"] : null,
});

const normalizeOverrideRow = (row: Record<string, unknown>): EvidenceOverrideRow => ({
  id: String(row.id),
  user_id: String(row.user_id),
  source_type: row.source_type as EvidenceSource,
  source_id: String(row.source_id),
  priority: Number(row.priority) || 0,
  is_pinned: Boolean(row.is_pinned),
  is_hidden: Boolean(row.is_hidden),
  theme_override: row.theme_override ? String(row.theme_override) : null,
  updated_at: String(row.updated_at),
});

export const useNeuroViewEvidence = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<EvidenceIndexRow[]>([]);
  const [overrides, setOverrides] = useState<EvidenceOverrideRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setOverrides([]);
      return;
    }
    setIsLoading(true);
    const [evidenceResult, overrideResult] = await Promise.all([
      supabase
        .from("neuroview_evidence_index")
        .select("id,user_id,patient_id,source_type,source_id,occurred_at,updated_at,title,tags,reviewed,is_actionable,action_due_at,action_completed,metadata")
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("neuroview_evidence_overrides")
        .select("id,user_id,source_type,source_id,priority,is_pinned,is_hidden,theme_override,updated_at")
        .eq("user_id", user.id),
    ]);

    if (evidenceResult.error) {
      const missingProjection = evidenceResult.error.code === "42P01" || evidenceResult.error.code === "PGRST205";
      setIsAvailable(!missingProjection);
      if (!missingProjection) console.error("[NeuroVision] Falha ao carregar o índice clínico:", evidenceResult.error);
      setRows([]);
    } else {
      setIsAvailable(true);
      setRows((evidenceResult.data || []).map((row) => normalizeIndexRow(row as Record<string, unknown>)));
    }

    if (overrideResult.error) {
      const missingProjection = overrideResult.error.code === "42P01" || overrideResult.error.code === "PGRST205";
      if (!missingProjection) console.error("[NeuroVision] Falha ao carregar preferências de evidência:", overrideResult.error);
      setOverrides([]);
    } else {
      setOverrides((overrideResult.data || []).map((row) => normalizeOverrideRow(row as Record<string, unknown>)));
    }
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    void load();
    const channel = supabase
      .channel(`neuroview_evidence_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "neuroview_evidence_index",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (active) void load();
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [load, user?.id]);

  const updateOverride = useCallback(async (update: EvidenceOverrideUpdate) => {
    if (!user?.id) throw new Error("Sessão indisponível.");
    const current = overrides.find((override) => (
      override.source_type === update.sourceType && override.source_id === update.sourceId
    ));
    const payload = {
      user_id: user.id,
      source_type: update.sourceType,
      source_id: update.sourceId,
      priority: update.priority ?? current?.priority ?? 0,
      is_pinned: update.isPinned ?? current?.is_pinned ?? false,
      is_hidden: update.isHidden ?? current?.is_hidden ?? false,
      theme_override: update.themeOverride === undefined ? current?.theme_override ?? null : update.themeOverride,
    };
    const { error } = await supabase
      .from("neuroview_evidence_overrides")
      .upsert(payload, { onConflict: "user_id,source_type,source_id" });
    if (error) throw error;
    await load();
  }, [load, overrides, user?.id]);

  const evidence = useMemo<EvidenceNode[]>(
    () => buildEvidenceNodes(rows, overrides),
    [overrides, rows],
  );

  return {
    evidence,
    isAvailable,
    isLoading,
    updateOverride,
    reload: load,
  };
};

export const useNeuroVisionEvidence = useNeuroViewEvidence;
