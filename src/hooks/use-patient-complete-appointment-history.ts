import { useInfiniteQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { repairMojibake } from "@/lib/text-encoding";

export interface SafePatientAppointmentEvent {
  title: string;
  actorName: string;
  channelName: string;
  occurredAt: string;
  statusChange: string | null;
  detail: string | null;
  visualKind: "default" | "success" | "cancel" | "archive" | "reschedule" | "financial" | "email";
}

export interface PatientAppointmentHistoryItem {
  occurredAt: string | null;
  endAt: string | null;
  modality: string;
  confirmation: string;
  lifecycle: string;
  attendance: string | null;
  reason: string | null;
  reschedules: number;
  policy: {
    cancellationDeadline: string | null;
    rescheduleDeadline: string | null;
    consequence: string;
  } | null;
  package: { name: string; coverage: string } | null;
  financial: { status: string; amount: number; refundAmount?: number } | null;
  nfse: { status: string; number?: string | null } | null;
  teleconsultation: string | null;
  clinicalSummary: string | null;
  archived: boolean;
  archiveLabel: string | null;
  events: SafePatientAppointmentEvent[];
}

interface PatientAppointmentHistoryPage {
  items: PatientAppointmentHistoryItem[];
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
}

const PAGE_SIZE = 12;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? repairMojibake(value.trim()) : null;

const asObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const normalizeEvent = (value: unknown): SafePatientAppointmentEvent | null => {
  const event = asObject(value);
  const title = asString(event?.title);
  const occurredAt = asString(event?.occurred_at);
  if (!event || !title || !occurredAt) return null;

  return {
    title,
    actorName: asString(event.actor_name) || "NeuroNex",
    channelName: asString(event.channel_name) || "Painel da NeuroNex",
    occurredAt,
    statusChange: asString(event.status_change),
    detail: asString(event.detail),
    visualKind: (asString(event.visual_kind) || "default") as SafePatientAppointmentEvent["visualKind"],
  };
};

const normalizeHistoryItem = (value: unknown): PatientAppointmentHistoryItem | null => {
  const item = asObject(value);
  if (!item) return null;
  const policy = asObject(item.policy);
  const packageCoverage = asObject(item.package);
  const financial = asObject(item.financial);
  const nfse = asObject(item.nfse);

  return {
    occurredAt: asString(item.occurredAt),
    endAt: asString(item.endAt),
    modality: asString(item.modality) || "Modalidade não informada",
    confirmation: asString(item.confirmation) || "Situação não informada",
    lifecycle: asString(item.lifecycle) || "Situação atualizada",
    attendance: asString(item.attendance),
    reason: asString(item.reason),
    reschedules: Number(item.reschedules || 0),
    policy: policy
      ? {
          cancellationDeadline: asString(policy.cancellationDeadline),
          rescheduleDeadline: asString(policy.rescheduleDeadline),
          consequence: asString(policy.consequence) || "Política registrada para esta sessão",
        }
      : null,
    package: packageCoverage
      ? {
          name: asString(packageCoverage.name) || "Pacote vinculado",
          coverage: asString(packageCoverage.coverage) || "Vínculo registrado",
        }
      : null,
    financial: financial
      ? {
          status: asString(financial.status) || "Registrado",
          amount: Number(financial.amount || 0),
          refundAmount: Number(financial.refundAmount || 0),
        }
      : null,
    nfse: nfse
      ? {
          status: asString(nfse.status) || "Registrada",
          number: asString(nfse.number),
        }
      : null,
    teleconsultation: asString(item.teleconsultation),
    clinicalSummary: asString(item.clinicalSummary),
    archived: Boolean(item.archived),
    archiveLabel: asString(item.archiveLabel),
    events: Array.isArray(item.events)
      ? item.events.map(normalizeEvent).filter((event): event is SafePatientAppointmentEvent => Boolean(event))
      : [],
  };
};

export const normalizePatientAppointmentHistoryPage = (value: unknown): PatientAppointmentHistoryPage => {
  const page = asObject(value);
  const items = Array.isArray(page?.items)
    ? page.items.map(normalizeHistoryItem).filter((item): item is PatientAppointmentHistoryItem => Boolean(item))
    : [];

  return {
    items,
    total: Number(page?.total || items.length),
    hasMore: Boolean(page?.hasMore),
    nextOffset: typeof page?.nextOffset === "number" ? page.nextOffset : null,
  };
};

export const usePatientCompleteAppointmentHistory = (patientId: string) =>
  useInfiniteQuery({
    queryKey: ["patient-complete-appointment-history", patientId],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("get_patient_complete_appointment_history", {
        p_patient_id: patientId,
        p_limit: PAGE_SIZE,
        p_offset: pageParam,
      });
      if (error) throw error;
      return normalizePatientAppointmentHistoryPage(data);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });
