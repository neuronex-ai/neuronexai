import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PublicAppointmentAction = "confirm" | "reschedule" | "cancel";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeAction(value: unknown): PublicAppointmentAction {
  const action = String(value || "").trim() as PublicAppointmentAction;
  if (!["confirm", "reschedule", "cancel"].includes(action)) throw new Error("Ação de agendamento inválida.");
  return action;
}

function validateFutureRange(newStartTime: unknown, newEndTime: unknown) {
  const start = new Date(String(newStartTime || ""));
  const end = new Date(String(newEndTime || ""));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new Error("Novos horários são obrigatórios para reagendamento.");
  }
  if (start.getTime() <= Date.now()) throw new Error("Escolha um horário futuro.");
  if (end.getTime() <= start.getTime()) throw new Error("Horário final inválido.");
  if (end.getTime() - start.getTime() > 4 * 60 * 60 * 1000) throw new Error("Duração de consulta inválida.");
  return { start, end };
}

async function resolveAppointmentByToken(admin: ReturnType<typeof adminClient>, token: string) {
  let appointment: any = null;

  if (isUuid(token)) {
    const tokenResult = await admin
      .from("appointment_confirmation_tokens")
      .select("appointment_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenResult.error) throw tokenResult.error;
    if (tokenResult.data) {
      if (new Date(tokenResult.data.expires_at).getTime() < Date.now()) {
        throw new Error("O link de confirmação expirou. Solicite um novo ao seu psicólogo.");
      }

      const appointmentResult = await admin
        .from("appointments")
        .select("*")
        .eq("id", tokenResult.data.appointment_id)
        .maybeSingle();
      if (appointmentResult.error) throw appointmentResult.error;
      appointment = appointmentResult.data;
    }
  }

  if (!appointment) {
    const legacyQuery = isUuid(token)
      ? admin.from("appointments").select("*").or(`token.eq.${token},id.eq.${token}`)
      : admin.from("appointments").select("*").eq("token", token);

    const legacyResult = await legacyQuery.maybeSingle();
    if (legacyResult.error) throw legacyResult.error;
    appointment = legacyResult.data;
  }

  if (!appointment) throw new Error("Token inválido ou agendamento não encontrado.");
  return appointment;
}

async function checkConflicts(admin: ReturnType<typeof adminClient>, appointment: any, start: Date, end: Date) {
  const { data, error } = await admin
    .from("appointments")
    .select("id")
    .eq("user_id", appointment.user_id)
    .neq("id", appointment.id)
    .not("status", "in", "(cancelled,canceled,cancelled_by_patient,cancelled_by_professional)")
    .lt("start_time", end.toISOString())
    .gt("end_time", start.toISOString())
    .limit(1);

  if (error) throw error;
  if (data && data.length > 0) throw new Error("O horário selecionado conflita com outro agendamento. Escolha outro horário.");
}

async function emitNotification(admin: ReturnType<typeof adminClient>, appointmentId: string, token: string, event: "confirmed" | "cancelled" | "rescheduled") {
  const { error } = await admin.rpc("emit_public_appointment_notification", {
    p_appointment_id: appointmentId,
    p_token: token,
    p_event: event,
  });

  if (error) console.error("[process-public-appointment] Failed to emit notification:", error);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  try {
    const admin = adminClient();
    const { token: rawToken, action: rawAction, newStartTime, newEndTime } = await req.json();
    const token = String(rawToken || "").trim();
    if (!token) throw new Error("Token obrigatório.");

    const action = normalizeAction(rawAction);
    const appointment = await resolveAppointmentByToken(admin, token);

    let updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let notificationEvent: "confirmed" | "cancelled" | "rescheduled";

    if (action === "confirm") {
      updates = { ...updates, status: "confirmed" };
      notificationEvent = "confirmed";
    } else if (action === "cancel") {
      updates = {
        ...updates,
        status: "cancelled_by_patient",
        notes: appointment.notes
          ? `${appointment.notes}\n[Cancelado pelo paciente via link público]`
          : "[Cancelado pelo paciente via link público]",
        metadata: {
          ...(appointment.metadata || {}),
          publicAppointmentAction: "cancelled_by_patient",
          publicAppointmentActionAt: new Date().toISOString(),
        },
      };
      notificationEvent = "cancelled";
    } else {
      const { start, end } = validateFutureRange(newStartTime, newEndTime);
      await checkConflicts(admin, appointment, start, end);
      updates = {
        ...updates,
        status: "pending",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        metadata: {
          ...(appointment.metadata || {}),
          publicAppointmentAction: "rescheduled_by_patient",
          publicAppointmentActionAt: new Date().toISOString(),
          requestedStartTime: start.toISOString(),
          requestedEndTime: end.toISOString(),
          syncStatus: "pending_professional_review",
        },
      };
      notificationEvent = "rescheduled";
    }

    const { data: updated, error: updateError } = await admin
      .from("appointments")
      .update(updates)
      .eq("id", appointment.id)
      .select("*")
      .single();

    if (updateError) throw updateError;
    await emitNotification(admin, appointment.id, token, notificationEvent);

    return jsonResponse({ success: true, event: notificationEvent, appointment: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível processar o agendamento.";
    return jsonResponse({ error: message }, 400);
  }
});
