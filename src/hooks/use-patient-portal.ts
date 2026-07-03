import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";

export type PatientPortalStatus = "needs_activation" | "active" | "suspended" | "revoked";

export interface PatientPortalContext {
  status: PatientPortalStatus;
  linkId?: string;
  patient: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    genderIdentity: string | null;
  } | null;
  professional: {
    id: string;
    name: string;
    clinicName: string | null;
    avatarUrl: string | null;
  } | null;
  features: Record<string, boolean>;
  linkedProfiles: Array<{
    linkId: string;
    patientId: string;
    status: string;
    professional: {
      id: string;
      name: string;
      clinicName: string | null;
      avatarUrl: string | null;
    };
  }>;
  message: string;
}

export interface PatientPortalInvitePreview {
  status: "ready" | "activated";
  inviteId: string;
  expiresAt: string;
  attemptsRemaining: number;
  patient: {
    name: string;
    emailMasked: string;
  };
  professional: {
    name: string;
    clinicName: string | null;
    avatarUrl: string | null;
  };
}

export interface PatientPortalAppointment {
  id: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  location: string | null;
  google_meet_link: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PatientPortalDocument {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  sharedAt: string | null;
  signedUrl: string | null;
}

export interface PatientPortalBillingEntry {
  id: string;
  title?: string;
  description?: string | null;
  amount: number;
  due_date: string | null;
  paid_at?: string | null;
  status: string;
  payment_method?: string | null;
  neurofinance_charge_id?: string | null;
  payment_url?: string | null;
  invoice_url?: string | null;
  bank_slip_url?: string | null;
  receipt_url?: string | null;
  pix_qr_code?: string | null;
  pix_copy_paste?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

export interface PatientPortalInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  due_date: string | null;
  receipt_url?: string | null;
  invoice_url?: string | null;
  bank_slip_url?: string | null;
  created_at: string;
}

export interface PatientPortalMoodLog {
  id: string;
  mood_score: number;
  notes: string | null;
  source: string;
  created_at: string;
}

export interface PatientPortalGoal {
  id: string;
  description: string;
  is_completed: boolean;
  due_date: string | null;
  created_at: string;
}

export interface PatientPortalAnamnesisItem {
  question: string;
  answer: string;
  isSection?: boolean;
}

export interface PatientPortalAnamnesis {
  id: string;
  type: string;
  content: PatientPortalAnamnesisItem[];
  progress: number;
  status: "pending" | "submitted" | "expired";
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
  tokenExpiresAt: string | null;
}

export interface PatientPortalPackage {
  id: string;
  description: string;
  total_sessions: number;
  sessions_used: number;
  price: number | null;
  start_date: string;
  end_date: string | null;
  due_day?: number | null;
  created_at: string;
}

export interface PatientPortalProgress {
  sessionsTotal: number;
  attendedSessions: number;
  goalsTotal: number;
  completedGoals: number;
  sharedDocuments: number;
  moodLogs: number;
  activePackages: number;
  lastMood: PatientPortalMoodLog | null;
  nextSteps: PatientPortalGoal[];
}

export interface PatientPortalSessionSummary {
  id: string;
  appointmentId: string;
  startTime: string;
  endTime: string | null;
  modality: string;
  statusLabel: string;
  transcriptionEnabled: boolean;
  hasSummary: boolean;
  summary: string | null;
  topics: string[];
  nextSteps: string[];
  emotionalAnalysis: string | null;
  sentiment: string | null;
  transcription: string | null;
  reviewStatus: "pending_review" | "confirmed" | "none";
  reviewDueAt: string | null;
}

export interface PatientPortalNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  referenceDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientPortalTask {
  id: string;
  title: string;
  content: string;
  isCompleted: boolean;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientPortalAppointmentRequest {
  startTime: string;
  type: "online" | "presencial";
}

export interface PatientPortalProfileUpdate {
  firstName: string;
  lastName: string;
  genderIdentity?: string | null;
  avatarFile?: File | null;
}

export interface PatientPortalAuthResult {
  status: "created" | "existing_user" | "access_link_sent" | "sent_if_exists";
  email: string;
  redirectTo?: string;
  message: string;
}

const readFunctionError = async (error: unknown, fallback: string) => {
  const context = (error as { context?: Response })?.context;
  if (context) {
    try {
      const payload = await context.clone().json();
      if (typeof payload?.error === "string") return payload.error;
    } catch {
      try {
        const text = await context.clone().text();
        if (text) return text;
      } catch {
        return fallback;
      }
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
};

const invokePortalFunction = async <T>(name: string, body?: Record<string, unknown>, fallback = "Não foi possível carregar o portal.") => {
  const { data, error } = await supabase.functions.invoke(name, { body: body || {} });
  if (error) throw new Error(await readFunctionError(error, fallback));
  return data as T;
};

export const useCreatePatientPortalInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patientId: string) =>
      invokePortalFunction<{
        status: "sent" | "linked";
        inviteId?: string;
        expiresAt?: string;
        patientEmail?: string;
        portalUrl?: string;
        message: string;
      }>("create-patient-portal-invite", { patientId }, "Não foi possível enviar o convite."),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-portal-invite-status"] });
    },
  });
};

export const usePatientPortalInvitePreview = (token?: string) =>
  useQuery({
    queryKey: ["patient-portal-invite-preview", token],
    queryFn: () =>
      invokePortalFunction<PatientPortalInvitePreview>(
        "patient-portal-invite-preview",
        { token },
        "Convite inválido ou expirado.",
      ),
    enabled: Boolean(token),
    retry: false,
  });

export const useActivatePatientPortal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ token, code }: { token?: string; code: string }) =>
      invokePortalFunction<PatientPortalContext>(
        "patient-portal-activate",
        { token, code },
        "Não foi possível ativar o portal.",
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-portal-current"] });
    },
  });
};

export const createPatientPortalAccess = (input: { email: string; password: string; inviteToken?: string }) =>
  invokePortalFunction<PatientPortalAuthResult>(
    "patient-portal-auth",
    {
      action: "signup",
      email: input.email,
      password: input.password,
      inviteToken: input.inviteToken || "",
    },
    "NÃ£o foi possÃ­vel criar o acesso do paciente.",
  );

export const sendPatientPortalAccessLink = (input: { email: string; inviteToken?: string }) =>
  invokePortalFunction<PatientPortalAuthResult>(
    "patient-portal-auth",
    {
      action: "send_access_link",
      email: input.email,
      inviteToken: input.inviteToken || "",
    },
    "NÃ£o foi possÃ­vel enviar o link de acesso.",
  );

export const sendPatientPortalPasswordReset = (input: { email: string; inviteToken?: string }) =>
  invokePortalFunction<PatientPortalAuthResult>(
    "patient-portal-auth",
    {
      action: "reset_password",
      email: input.email,
      inviteToken: input.inviteToken || "",
    },
    "NÃ£o foi possÃ­vel enviar o e-mail de redefiniÃ§Ã£o.",
  );

export const usePatientPortalCurrent = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["patient-portal-current", user?.id],
    queryFn: () => invokePortalFunction<PatientPortalContext>("patient-portal-current"),
    enabled: Boolean(user?.id),
    retry: false,
  });
};

export const usePatientPortalAppointments = (enabled = true) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["patient-portal-appointments", user?.id],
    queryFn: () =>
      invokePortalFunction<{ appointments: PatientPortalAppointment[] }>("patient-portal-current", { action: "appointments" }),
    enabled: Boolean(user?.id) && enabled,
  });
};

export const usePatientPortalDocuments = (enabled = true) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["patient-portal-documents", user?.id],
    queryFn: () =>
      invokePortalFunction<{ documents: PatientPortalDocument[] }>("patient-portal-current", { action: "documents" }),
    enabled: Boolean(user?.id) && enabled,
  });
};

export const usePatientPortalBilling = (enabled = true) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["patient-portal-billing", user?.id],
    queryFn: () =>
      invokePortalFunction<{ entries: PatientPortalBillingEntry[]; invoices: PatientPortalInvoice[] }>("patient-portal-current", { action: "billing" }),
    enabled: Boolean(user?.id) && enabled,
  });
};

export const usePatientPortalAnamnesis = (enabled = true) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["patient-portal-anamnesis", user?.id],
    queryFn: () =>
      invokePortalFunction<{ anamneses: PatientPortalAnamnesis[] }>("patient-portal-current", { action: "anamnesis" }),
    enabled: Boolean(user?.id) && enabled,
  });
};

export const usePatientPortalPackages = (enabled = true) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["patient-portal-packages", user?.id],
    queryFn: () =>
      invokePortalFunction<{ packages: PatientPortalPackage[] }>("patient-portal-current", { action: "packages" }),
    enabled: Boolean(user?.id) && enabled,
  });
};

export const usePatientPortalProgress = (enabled = true) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["patient-portal-progress", user?.id],
    queryFn: () =>
      invokePortalFunction<{ progress: PatientPortalProgress }>("patient-portal-current", { action: "progress" }),
    enabled: Boolean(user?.id) && enabled,
  });
};

export const usePatientPortalAppointmentRequests = (enabled = true) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["patient-portal-appointment-requests", user?.id],
    queryFn: () =>
      invokePortalFunction<{ requests: PatientPortalAppointment[] }>("patient-portal-current", { action: "appointment_requests" }),
    enabled: Boolean(user?.id) && enabled,
  });
};

export const usePatientPortalSessionSummaries = (enabled = true) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["patient-portal-session-summaries", user?.id],
    enabled: Boolean(user?.id) && enabled,
    queryFn: () =>
      invokePortalFunction<{ summaries: PatientPortalSessionSummary[] }>("patient-portal-current", { action: "session_summaries" }),
  });
};

export const usePatientPortalNotes = (enabled = true) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["patient-portal-notes", user?.id] as const;

  const query = useQuery({
    queryKey,
    queryFn: () =>
      invokePortalFunction<{ notes: PatientPortalNote[] }>("patient-portal-current", { action: "patient_notes" }),
    enabled: Boolean(user?.id) && enabled,
  });

  const saveNote = useMutation({
    mutationFn: (input: { noteId?: string; title: string; content: string }) =>
      invokePortalFunction<{ note: PatientPortalNote }>("patient-portal-current", {
        action: "save_patient_note",
        noteId: input.noteId,
        title: input.title,
        content: input.content,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) =>
      invokePortalFunction<{ deleted: true }>("patient-portal-current", {
        action: "delete_patient_note",
        noteId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    ...query,
    saveNote,
    deleteNote,
  };
};

export const usePatientPortalTasks = (enabled = true) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["patient-portal-tasks", user?.id] as const;

  const query = useQuery({
    queryKey,
    queryFn: () =>
      invokePortalFunction<{ tasks: PatientPortalTask[] }>("patient-portal-current", { action: "patient_tasks" }),
    enabled: Boolean(user?.id) && enabled,
  });

  const saveTask = useMutation({
    mutationFn: (input: { taskId?: string; title: string; content?: string; dueDate?: string | null }) =>
      invokePortalFunction<{ task: PatientPortalTask }>("patient-portal-current", {
        action: "save_patient_task",
        taskId: input.taskId,
        title: input.title,
        content: input.content || "",
        dueDate: input.dueDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const toggleTask = useMutation({
    mutationFn: ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) =>
      invokePortalFunction<{ task: PatientPortalTask }>("patient-portal-current", {
        action: "toggle_patient_task",
        taskId,
        isCompleted,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) =>
      invokePortalFunction<{ deleted: true }>("patient-portal-current", {
        action: "delete_patient_task",
        taskId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    ...query,
    saveTask,
    toggleTask,
    deleteTask,
  };
};

export const usePatientPortalMood = (enabled = true) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["patient-portal-mood", user?.id],
    queryFn: () =>
      invokePortalFunction<{ logs: PatientPortalMoodLog[]; today: PatientPortalMoodLog | null }>("patient-portal-current", { action: "mood" }),
    enabled: Boolean(user?.id) && enabled,
  });

  const saveMood = useMutation({
    mutationFn: ({ moodScore, notes }: { moodScore: number; notes?: string }) =>
      invokePortalFunction<{ logs: PatientPortalMoodLog[]; today: PatientPortalMoodLog | null }>(
        "patient-portal-current",
        { action: "mood", moodScore, notes },
        "Não foi possível salvar o diário.",
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-portal-mood", user?.id] });
    },
  });

  return { ...query, saveMood };
};

export const usePatientPortalGoals = (enabled = true) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["patient-portal-goals", user?.id],
    queryFn: () =>
      invokePortalFunction<{ goals: PatientPortalGoal[] }>("patient-portal-current", { action: "goals" }),
    enabled: Boolean(user?.id) && enabled,
  });
};

export const useRequestPatientPortalAppointment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ startTime, type }: PatientPortalAppointmentRequest) =>
      invokePortalFunction<{ appointment: PatientPortalAppointment }>(
        "patient-portal-current",
        { action: "request_appointment", startTime, type },
        "Não foi possível solicitar o horário.",
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-portal-appointments", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["patient-portal-appointment-requests", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["patient-portal-history", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["patient-portal-progress", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["patient-portal-current", user?.id] });
    },
  });
};

export const useTogglePatientPortalGoal = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ goalId, isCompleted }: { goalId: string; isCompleted: boolean }) =>
      invokePortalFunction<{ goal: PatientPortalGoal }>(
        "patient-portal-current",
        { action: "toggle_goal", goalId, isCompleted },
        "Não foi possível atualizar a missão.",
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-portal-goals", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["patient-portal-history", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["patient-portal-progress", user?.id] });
    },
  });
};

export const useSavePatientPortalAnamnesis = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ anamnesisId, content }: { anamnesisId: string; content: PatientPortalAnamnesisItem[] }) =>
      invokePortalFunction<{ anamnesis: PatientPortalAnamnesis }>(
        "patient-portal-current",
        { action: "save_anamnesis", anamnesisId, content },
        "Não foi possível salvar a anamnese.",
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-portal-anamnesis", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["patient-portal-history", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["patient-portal-progress", user?.id] });
    },
  });
};

export const useUpdatePatientPortalProfile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ firstName, lastName, genderIdentity, avatarFile }: PatientPortalProfileUpdate) => {
      let avatarUrl: string | null | undefined;

      if (avatarFile) {
        if (!user?.id) throw new Error("Usuário não autenticado.");
        if (!avatarFile.type.startsWith("image/")) throw new Error("Envie uma imagem válida.");
        if (avatarFile.size > 4 * 1024 * 1024) throw new Error("A imagem deve ter até 4 MB.");

        const extension = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const filePath = `patient-portal/${user.id}/avatar.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (uploadError) throw new Error(uploadError.message);

        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
        avatarUrl = data.publicUrl;
      }

      return invokePortalFunction<PatientPortalContext>(
        "patient-portal-current",
        {
          action: "update_profile",
          firstName,
          lastName,
          genderIdentity,
          avatarUrl,
        },
        "Não foi possível atualizar seu perfil.",
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-portal-current", user?.id] });
    },
  });
};
