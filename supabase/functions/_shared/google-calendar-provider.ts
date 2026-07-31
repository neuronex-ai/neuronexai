import { ensureTeleconsultationInvite } from "./teleconsultation-access.ts";

type AdminClient = any;

export type GoogleCalendarOperation = "create" | "update" | "cancel";

export class GoogleCalendarConnectionRequiredError extends Error {
  readonly code = "GOOGLE_CONNECTION_REQUIRED";

  constructor(message = "A conta Google precisa ser reconectada.") {
    super(message);
    this.name = "GoogleCalendarConnectionRequiredError";
  }
}

export class GoogleCalendarProviderError extends Error {
  readonly code = "GOOGLE_PROVIDER_ERROR";
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable = true) {
    super(message);
    this.name = "GoogleCalendarProviderError";
    this.status = status;
    this.retryable = retryable;
  }
}

const recordOf = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};

const isSession = (appointment: Record<string, any>) =>
  recordOf(appointment.metadata).kind !== "event" && Boolean(appointment.patient_id);

const isOnline = (appointment: Record<string, any>) =>
  appointment.type === "online" || recordOf(appointment.metadata).modality === "online";

const googleRequestReason = "Synchronizing a committed NeuroNex appointment";

const googleEnv = (name: string) => {
  try {
    return Deno.env.get(name) || "";
  } catch {
    return "";
  }
};

async function deterministicGoogleEventId(appointmentId: string) {
  const bytes = new TextEncoder().encode(`neuronex:appointment:${appointmentId}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `a${Array.from(digest).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function refreshAccessToken(
  db: AdminClient,
  professionalId: string,
  refreshToken: string,
) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleEnv("GOOGLE_CLIENT_ID"),
      client_secret: googleEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!response.ok) {
    const details = await response.text();
    if ([400, 401, 403].includes(response.status)) {
      throw new GoogleCalendarConnectionRequiredError(details || undefined);
    }
    throw new GoogleCalendarProviderError(
      `Falha ao renovar autorização do Google (${response.status}).`,
      response.status,
    );
  }

  const tokens = await response.json();
  const accessToken = String(tokens.access_token || "");
  if (!accessToken) {
    throw new GoogleCalendarConnectionRequiredError();
  }
  const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1_000)
    .toISOString();
  const updated = await db
    .from("user_google_tokens")
    .update({ access_token: accessToken, expires_at: expiresAt })
    .eq("user_id", professionalId);
  if (updated.error) throw updated.error;
  return accessToken;
}

async function accessTokenFor(db: AdminClient, professionalId: string) {
  const tokenResult = await db
    .from("user_google_tokens")
    .select("access_token,refresh_token,expires_at")
    .eq("user_id", professionalId)
    .maybeSingle();
  if (tokenResult.error) throw tokenResult.error;
  if (!tokenResult.data) throw new GoogleCalendarConnectionRequiredError();

  const expiresAt = Date.parse(String(tokenResult.data.expires_at || ""));
  if (
    String(tokenResult.data.access_token || "") &&
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now() + 60_000
  ) {
    return String(tokenResult.data.access_token);
  }
  const refreshToken = String(tokenResult.data.refresh_token || "");
  if (!refreshToken) throw new GoogleCalendarConnectionRequiredError();
  return refreshAccessToken(db, professionalId, refreshToken);
}

function googleEventBody(
  appointment: Record<string, any>,
  patient: Record<string, any> | null,
  professionalEmail: string | null,
  profileAddress: string | null,
  eventId: string,
) {
  const metadata = recordOf(appointment.metadata);
  const session = isSession(appointment);
  const online = session && isOnline(appointment);
  const meetLink = online && typeof appointment.google_meet_link === "string"
      ? appointment.google_meet_link
      : null;
  const title = session
    ? `Consulta: ${patient?.name || "Paciente"}`
    : String(metadata.eventTitle || appointment.notes?.split("\n")?.[0] || "Compromisso");
  const location = session
    ? online
      ? meetLink || appointment.location || "Teleconsulta NeuroNex"
      : appointment.location || profileAddress || undefined
    : metadata.eventLocation || appointment.location || undefined;
  const timeZone = String(metadata.timezone || "America/Sao_Paulo");

  const body: Record<string, unknown> = {
    id: eventId,
    summary: title,
    description: session
      ? [
        `Tipo: ${online ? "Teleconsulta (Online)" : "Presencial"}`,
        `Sessão: ${metadata.sessionType || "follow_up"}`,
        meetLink ? `Link da teleconsulta NeuroNex: ${meetLink}` : null,
        appointment.notes ? `Notas: ${appointment.notes}` : null,
        "",
        "---",
        "Evento sincronizado pelo NeuroNex.",
      ].filter(Boolean).join("\n")
      : [
        `Categoria: ${metadata.eventCategoryLabel || metadata.eventCategory || "Compromisso"}`,
        metadata.eventNotes || appointment.notes
          ? `Notas: ${metadata.eventNotes || appointment.notes}`
          : null,
        "",
        "---",
        "Compromisso sincronizado pelo NeuroNex.",
      ].filter(Boolean).join("\n"),
    start: { dateTime: appointment.start_time, timeZone },
    end: { dateTime: appointment.end_time, timeZone },
    attendees: [
      ...(professionalEmail ? [{ email: professionalEmail }] : []),
      ...(session && patient?.email ? [{ email: patient.email }] : []),
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 },
        { method: "popup", minutes: 30 },
      ],
    },
  };
  if (location) body.location = location;
  return body;
}

async function googleFetch(
  url: string,
  accessToken: string,
  init: RequestInit,
  acceptedStatuses: number[] = [],
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Goog-Request-Reason": googleRequestReason,
      ...(init.headers || {}),
    },
  });
  if (response.ok || acceptedStatuses.includes(response.status)) return response;
  const details = await response.text();
  if ([401, 403].includes(response.status)) {
    throw new GoogleCalendarConnectionRequiredError(details || undefined);
  }
  throw new GoogleCalendarProviderError(
    `Google Calendar recusou a sincronização (${response.status}): ${details.slice(0, 500)}`,
    response.status,
    response.status === 408 || response.status === 429 || response.status >= 500,
  );
}

export async function syncCommittedAppointmentToGoogle(input: {
  db: AdminClient;
  professionalId: string;
  appointmentId: string;
  operation: GoogleCalendarOperation;
}) {
  const appointmentResult = await input.db
    .from("appointments")
    .select(
      "id,user_id,patient_id,start_time,end_time,type,status,lifecycle_status,notes,location,google_meet_link,google_event_id,metadata,confirmation_revision",
    )
    .eq("id", input.appointmentId)
    .eq("user_id", input.professionalId)
    .maybeSingle();
  if (appointmentResult.error) throw appointmentResult.error;
  if (!appointmentResult.data) throw new Error("Agendamento não encontrado.");

  let appointment = appointmentResult.data as Record<string, any>;
  const accessToken = await accessTokenFor(input.db, input.professionalId);
  const existingEventId = String(appointment.google_event_id || "").trim();
  const eventId = existingEventId || await deterministicGoogleEventId(appointment.id);
  const eventUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;

  if (input.operation === "cancel") {
    await googleFetch(`${eventUrl}?sendUpdates=all`, accessToken, { method: "DELETE" }, [404, 410]);
    return { success: true, operation: "cancel", googleEventId: eventId };
  }

  const [patientResult, profileResult, accountResult] = await Promise.all([
    appointment.patient_id
      ? input.db.from("patients").select("name,email,phone").eq("id", appointment.patient_id)
        .eq("user_id", input.professionalId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    input.db.from("profiles").select("address").eq("id", input.professionalId).maybeSingle(),
    input.db.auth.admin.getUserById(input.professionalId),
  ]);
  if (patientResult.error) throw patientResult.error;
  if (profileResult.error) throw profileResult.error;
  if (accountResult.error) throw accountResult.error;

  if (isSession(appointment) && isOnline(appointment)) {
    const invite = await ensureTeleconsultationInvite(input.db, appointment);
    appointment = { ...appointment, google_meet_link: invite.meetLink };
  }

  const sendUpdates = isSession(appointment) ? "all" : "none";
  const body = googleEventBody(
    appointment,
    patientResult.data,
    accountResult.data.user?.email || null,
    profileResult.data?.address || null,
    eventId,
  );
  const patch = () => googleFetch(
    `${eventUrl}?sendUpdates=${sendUpdates}`,
    accessToken,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    [404, 410],
  );

  let response: Response;
  if (existingEventId || input.operation === "update") {
    response = await patch();
    if ([404, 410].includes(response.status)) {
      response = await googleFetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=${sendUpdates}`,
        accessToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        [409],
      );
      if (response.status === 409) response = await patch();
    }
  } else {
    response = await googleFetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=${sendUpdates}`,
      accessToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      [409],
    );
    if (response.status === 409) response = await patch();
  }

  const event = await response.json().catch(() => ({}));
  return {
    success: true,
    operation: existingEventId ? "update" : "create",
    googleEventId: String(event.id || eventId),
    googleUpdatedAt: event.updated || null,
    googleMeetLink: appointment.google_meet_link || null,
  };
}
