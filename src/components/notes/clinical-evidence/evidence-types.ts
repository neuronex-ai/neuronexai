export type EvidenceSource =
  | "personal_note"
  | "flow"
  | "session_note"
  | "ai_summary"
  | "mood"
  | "goal"
  | "anamnesis"
  | "appointment"
  | "reminder"
  | "finance";

export type NeuroVisionLens = "panorama" | "session-prep" | "patterns" | "attention";

// Compatibility alias. Scene commands and persisted integrations still use the
// original protocol name until the backend migration happens in a later phase.
export type NeuroViewLens = NeuroVisionLens;

export type GravityBreakdown = {
  formulaVersion: "neurovision-attention-v2";
  recency: number;
  recurrence: number;
  sourceDiversity: number;
  relationSupport: number;
  density: number;
  acceleration: number;
  objectiveChange: number | null;
  connectionStrength: number;
  tension: number;
  actionability: number;
  clinicianPriority: number;
  confidence: number;
  score: number;
  eligible: boolean;
};

export type PatientAttentionSummary = {
  score: number;
  confidence: number;
  highestThemeScore: number;
  topThreeAverage: number;
  criticalPending: number;
  dominantTheme: string | null;
  evidenceCount: number;
};

export type AttentionReasonType =
  | "recorded-risk"
  | "overdue-action"
  | "pending-review"
  | "observed-mood-change";

export type AttentionReason = {
  type: AttentionReasonType;
  label: string;
  detail: string;
  sourceIds: string[];
};

export type EvidenceMetadata = {
  reviewStatus?: string | null;
  sentiment?: string | null;
  nextSteps?: string[];
  moodScore?: number | null;
  appointmentStatus?: string | null;
  clinicalOutcome?: string | null;
  category?: string | null;
  [key: string]: unknown;
};

export type EvidenceNode = {
  id: string;
  sourceId: string;
  sourceType: EvidenceSource;
  patientId: string | null;
  title: string;
  occurredAt: string;
  updatedAt: string;
  tags: string[];
  reviewed: boolean;
  isActionable: boolean;
  actionDueAt: string | null;
  actionCompleted: boolean;
  priority: number;
  pinned: boolean;
  hidden: boolean;
  theme: string;
  metadata: EvidenceMetadata;
  gravity: GravityBreakdown;
};

export type EvidenceIndexRow = {
  id: string;
  user_id: string;
  patient_id: string | null;
  source_type: EvidenceSource;
  source_id: string;
  occurred_at: string;
  updated_at: string;
  title: string;
  tags: string[];
  reviewed: boolean;
  is_actionable: boolean;
  action_due_at: string | null;
  action_completed: boolean;
  metadata: EvidenceMetadata | null;
};

export type EvidenceOverrideRow = {
  id: string;
  user_id: string;
  source_type: EvidenceSource;
  source_id: string;
  priority: number;
  is_pinned: boolean;
  is_hidden: boolean;
  theme_override: string | null;
  updated_at: string;
};

export type NeuroVisionTimeWindow = {
  start?: number | null;
  end?: number | null;
};

export type NeuroViewTimeWindow = NeuroVisionTimeWindow;
