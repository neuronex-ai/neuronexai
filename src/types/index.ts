import type { AppointmentMetadata } from "@/lib/appointment-metadata";
import type { AppointmentStatus, LegacyAppointmentStatus } from "@/lib/appointment-status";

export interface Patient {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf?: string | null;
  group_type?: 'adult' | 'child' | 'adolescent' | 'elderly' | string;
  quick_registration?: boolean;
  phone_country_code?: string | null;
  mobile_phone?: string | null;
  landline_phone?: string | null;
  rg?: string | null;
  gender_identity?: 'male' | 'female' | 'agender' | 'gender_fluid' | 'non_binary' | 'transgender' | 'prefer_not_to_say' | 'other' | string | null;
  has_social_name?: boolean;
  social_name?: string | null;
  status: string | null;
  last_session: string | null;
  next_session: string | null;
  diagnosis: string | null;
  notes: string | null;
  created_at: string;
  birth_date?: string | null;
  address?: string | null;
  country?: string | null;
  postal_code?: string | null;
  city?: string | null;
  state?: string | null;
  street?: string | null;
  street_number?: string | null;
  neighborhood?: string | null;
  complement?: string | null;
  naturality?: string | null;
  education_level?: string | null;
  race?: string | null;
  profession?: string | null;
  relative_name?: string | null;
  relative_relationship?: string | null;
  relative_phone?: string | null;
  referred_by_option_id?: string | null;
  emergency_contact?: string | null;
  payer_type?: 'patient' | 'other' | null;
  payer_name?: string | null;
  payer_cpf?: string | null;
  risk_score?: number;
  risk_score_scale?: 10 | 100;
  avatar_url?: string | null;
  medications?: Medication[] | null;
}

export interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
}

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name?: string | null;
  name?: string | null;
  clinic_name: string | null;
  crp: string | null;
  address: string | null;
  phone: string | null;
  recovery_email?: string | null;
  professional_context?: string | null;
  gender_identity?: 'female' | 'male' | 'non_binary' | 'prefer_not_to_say' | string | null;
  bio: string | null;
  avatar_url: string | null;
  specialty?: string | null;
  public_slug?: string | null;
  subscription_plan?: string | null;
  updated_at: string;
  two_factor_enabled?: boolean;
  sms_notifications_enabled?: boolean;
  setup_completed?: boolean;
  signup_completed_at?: string | null;
  initial_preferences?: Record<string, unknown> | null;
  professional_address?: Record<string, unknown> | null;
  calendar_sync_enabled?: boolean;
  gmail_send_enabled?: boolean;
  neurofinance_intro_choice?: 'create_now' | 'later' | string | null;
  working_hours?: any;
}

/**
 * Representa um agendamento ou compromisso no calendário.
 */
export interface Appointment {
  id: string;
  /** ID do profissional proprietário do registro (UUID) */
  user_id: string;
  /** ID do paciente vinculado ou null para bloqueios de horário */
  patient_id: string | null;
  /** Data e hora de início em formato ISO 8601 */
  start_time: string;
  /** Data e hora de término em formato ISO 8601 */
  end_time: string;
  /** Modalidade do atendimento ou tipo de bloqueio administrativo */
  type: 'presencial' | 'online' | 'block';
  /** Estado atual do agendamento no workflow clínico */
  status: AppointmentStatus | LegacyAppointmentStatus;
  /** Estado operacional de convite, confirmação e reagendamento */
  lifecycle_status?:
    | 'created'
    | 'invitation_sent'
    | 'awaiting_confirmation'
    | 'awaiting_reconfirmation'
    | 'confirmed'
    | 'cancellation_requested'
    | 'cancelled'
    | 'reschedule_requested'
    | 'reschedule_approved'
    | 'reschedule_rejected'
    | 'in_progress'
    | 'completed'
    | 'closed';
  previous_status?: string | null;
  invitation_sent_at?: string | null;
  invitation_opened_at?: string | null;
  confirmed_at?: string | null;
  /** Monotonic version of patient-facing scheduling details. */
  confirmation_revision?: number;
  /** Version currently confirmed by the patient; null requires confirmation. */
  confirmed_revision?: number | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  reschedule_requested_at?: string | null;
  reschedule_approved_at?: string | null;
  reschedule_rejected_at?: string | null;
  /** Canonical recurrence series. Null for legacy and non-recurring appointments. */
  series_id?: string | null;
  /** One-based position inside the series. */
  occurrence_number?: number | null;
  /** Exact total number of appointments in the series. */
  occurrence_count?: number | null;
  payment_status?: string | null;
  financial_launch_id?: string | null;
  financial_entry_id?: string | null;
  package_id?: string | null;
  charge_id?: string | null;
  /** Observações privadas do profissional sobre o agendamento */
  notes: string | null;
  /** Endereço físico ou link da videochamada */
  location: string | null;
  created_at: string;
  updated_at?: string;
  metadata?: AppointmentMetadata | null;
  /** Preço da sessão individual se não for pacote */
  price?: number | null;
  /** Nome do paciente persistido para performance em listagens */
  patient_name?: string;
  patient_email?: string;
  patient_phone?: string;
  patient_initials?: string;
  /** Identificador único do evento no Google Calendar sincronizado */
  google_event_id?: string | null;
  /** URL da sala de conferência para consultas online */
  google_meet_link?: string | null;
  /** Visual archive fields. Archived appointments remain in the patient record. */
  archived_at?: string | null;
  archived_by?: string | null;
  archive_reason?: string | null;
  visibility_status?: 'visible' | 'archived';
  archive_origin?: string | null;
}

/** Métodos de pagamento suportados nativamente pela infraestrutura NeuroNex */
export type PaymentMethod = 'pix' | 'money' | 'credit_card' | 'debit_card' | 'boleto' | 'mixed';
export type TransactionOrigin = 'manual' | 'gateway_auto';

export interface Transaction {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string | null;
  date: string;
  appointment_id: string | null;
  created_at: string;

  // Novos Campos
  payment_method?: PaymentMethod;
  installments?: number; // 1 = à vista
  package_id?: string; // Vínculo com pacote
  external_reference?: string; // ID da nota, comprovante, recibo
  attachment_url?: string; // URL do comprovante (PDF/IMG)
  origin?: TransactionOrigin;
  patient_id?: string;
  patient_name?: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
  receipt_url?: string;
  invoice_url?: string;
  bank_slip_url?: string;
  patients?: {
    name: string;
    email: string | null;
  } | null;
}

export interface RecurringExpense {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  category: string | null;
  day_of_month: number;
  active: boolean;
  last_generated_date: string | null;
  created_at: string;
}

export interface AISummary {
  sentiment: 'Positivo' | 'Neutro' | 'Negativo' | string;
  summary: string;
  topics: string[];
  next_steps: string[];
  emotional_analysis?: string;
}

export type SessionNoteReviewStatus = 'pending_review' | 'confirmed';

export interface SessionNote {
  id: string;
  user_id: string;
  patient_id: string;
  appointment_id: string | null;
  notes: string;
  ai_summary: AISummary | null;
  transcription: string | null;
  created_at: string;
  review_status?: SessionNoteReviewStatus;
  review_due_at?: string | null;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
  auto_confirmed_at?: string | null;
  locked_at?: string | null;
  source_transcript_id?: string | null;
  original_ai_summary?: AISummary | null;
  original_transcription?: string | null;
  ai_summary_edited?: boolean;
  ai_summary_edited_at?: string | null;
  ai_summary_edited_by?: string | null;
  ai_summary_edit_count?: number;
}

export interface PatientPackage {
  id: string;
  user_id: string;
  patient_id: string;
  description: string;
  name?: string; // Alias for description
  active?: boolean | string | null;
  billing_mode?: 'upfront' | 'per_session' | 'installment' | null;
  billing_status?: 'unconfigured' | 'pending' | 'partially_paid' | 'paid' | 'cancelled' | null;
  default_payment_method?: string | null;
  package_status?: 'active' | 'paused' | 'completed' | 'cancelled' | 'ended' | 'replaced' | null;
  total_sessions: number;
  sessions_used: number;
  sessions_reserved?: number;
  price: number | null;
  start_date: string;
  end_date: string | null;
  due_day?: number | null;
  ended_at?: string | null;
  ended_reason?: string | null;
  replaced_by_package_id?: string | null;
  created_at: string;
}

export interface PatientGoal {
  id: string;
  user_id: string;
  patient_id: string;
  description: string;
  is_completed: boolean;
  due_date: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  patient_id: string;
  invoice_number: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'overdue';
  due_date: string | null;
  created_at: string;
  description?: string;
  appointment_id?: string | null;

  // Payment gateway integration
  gateway_payment_id?: string | null;
  pdf_url?: string | null;
  payment_url?: string | null; // Payment links / checkout URL
  metadata?: Record<string, any> | null;

  // NFS-e data from NeuroFinance/Asaas
  nfse_reference?: string | null;
  nfse_status?: string | null;
  nfse_number?: string | null;
  nfse_verification_code?: string | null;
  nfse_pdf_url?: string | null;
  nfse_xml_url?: string | null;
  nfse_status_description?: string | null;
  nfse_error_message?: string | null;
  nfse_synced_at?: string | null;
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  user_id: string;
  session_id?: string;
  attachments?: any[];
}

export interface Reminder {
  id: string;
  user_id: string;
  note_id: string | null;
  title: string;
  due_date: string; // ISO String
  category: 'Geral' | 'Urgente' | 'Pessoal' | 'Clínico' | 'Financeiro';
  is_completed: boolean;
  created_at: string;
}

export interface PersonalNote {
  id: string;
  user_id: string;
  module_id: string | null;
  patient_id: string | null;
  title: string;
  content: string;
  tags: string[];
  reference_date: string;
  updated_at: string;
  created_at: string;
  patient_name?: string;
}

export interface MoodLog {
  id: string;
  patient_id: string;
  mood_score: number;
  notes?: string | null;
  created_at: string;
}
