export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_roles: {
        Row: {
          created_at: string | null
          granted_by: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      appointment_action_plan_events: {
        Row: {
          action_origin: string
          actor_type: string
          actor_user_id: string | null
          appointment_id: string | null
          confirmation_channel: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          idempotency_key: string
          patient_id: string | null
          plan_id: string
          plan_version: number
          professional_id: string
          safe_metadata: Json
          to_status: string | null
        }
        Insert: {
          action_origin: string
          actor_type: string
          actor_user_id?: string | null
          appointment_id?: string | null
          confirmation_channel?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          idempotency_key: string
          patient_id?: string | null
          plan_id: string
          plan_version: number
          professional_id: string
          safe_metadata?: Json
          to_status?: string | null
        }
        Update: {
          action_origin?: string
          actor_type?: string
          actor_user_id?: string | null
          appointment_id?: string | null
          confirmation_channel?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          idempotency_key?: string
          patient_id?: string | null
          plan_id?: string
          plan_version?: number
          professional_id?: string
          safe_metadata?: Json
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_action_plan_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_action_plan_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_action_plan_events_plan_fkey"
            columns: ["plan_id", "plan_version"]
            isOneToOne: false
            referencedRelation: "appointment_action_plans"
            referencedColumns: ["plan_id", "plan_version"]
          },
        ]
      }
      appointment_action_plans: {
        Row: {
          action: string
          appointment_id: string | null
          cancelled_at: string | null
          completed_at: string | null
          confirmation_channel: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          conversation_id: string | null
          correlation_id: string | null
          created_at: string
          executing_at: string | null
          expires_at: string
          failed_at: string | null
          id: string
          idempotency_key: string
          immutable_snapshot: Json
          last_error: string | null
          origin_channel: string
          patient_id: string | null
          plan_hash: string
          plan_id: string
          plan_version: number
          professional_id: string
          result_internal: Json | null
          result_public: Json | null
          safe_summary: Json
          series_id: string | null
          snapshot_version: number
          status: string
          superseded_at: string | null
          tool_call: string | null
          updated_at: string
          voice_session_id: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          action: string
          appointment_id?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          confirmation_channel?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          conversation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          executing_at?: string | null
          expires_at?: string
          failed_at?: string | null
          id?: string
          idempotency_key: string
          immutable_snapshot: Json
          last_error?: string | null
          origin_channel: string
          patient_id?: string | null
          plan_hash: string
          plan_id?: string
          plan_version?: number
          professional_id: string
          result_internal?: Json | null
          result_public?: Json | null
          safe_summary: Json
          series_id?: string | null
          snapshot_version?: number
          status?: string
          superseded_at?: string | null
          tool_call?: string | null
          updated_at?: string
          voice_session_id?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          action?: string
          appointment_id?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          confirmation_channel?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          conversation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          executing_at?: string | null
          expires_at?: string
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          immutable_snapshot?: Json
          last_error?: string | null
          origin_channel?: string
          patient_id?: string | null
          plan_hash?: string
          plan_id?: string
          plan_version?: number
          professional_id?: string
          result_internal?: Json | null
          result_public?: Json | null
          safe_summary?: Json
          series_id?: string | null
          snapshot_version?: number
          status?: string
          superseded_at?: string | null
          tool_call?: string | null
          updated_at?: string
          voice_session_id?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_action_plans_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_action_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_action_plans_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "appointment_series"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_communication_outbox: {
        Row: {
          appointment_end_time: string
          appointment_id: string
          appointment_revision: number
          appointment_start_time: string
          attempts: number
          claimed_at: string | null
          created_at: string
          delivered_at: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          lease_expires_at: string | null
          lease_token: string | null
          next_attempt_at: string
          patient_id: string | null
          payload: Json
          payload_fingerprint: string
          policy_snapshot_id: string | null
          provider: string | null
          provider_message_id: string | null
          psychologist_id: string
          reschedule_request_id: string | null
          status: string
          template_key: string
          updated_at: string
        }
        Insert: {
          appointment_end_time: string
          appointment_id: string
          appointment_revision: number
          appointment_start_time: string
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          idempotency_key: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          patient_id?: string | null
          payload?: Json
          payload_fingerprint: string
          policy_snapshot_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          psychologist_id: string
          reschedule_request_id?: string | null
          status?: string
          template_key: string
          updated_at?: string
        }
        Update: {
          appointment_end_time?: string
          appointment_id?: string
          appointment_revision?: number
          appointment_start_time?: string
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          idempotency_key?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          patient_id?: string | null
          payload?: Json
          payload_fingerprint?: string
          policy_snapshot_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          psychologist_id?: string
          reschedule_request_id?: string | null
          status?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_communication_outbox_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_communication_outbox_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_communication_outbox_policy_snapshot_id_fkey"
            columns: ["policy_snapshot_id"]
            isOneToOne: false
            referencedRelation: "appointment_policy_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_communication_outbox_reschedule_request_id_fkey"
            columns: ["reschedule_request_id"]
            isOneToOne: false
            referencedRelation: "appointment_reschedule_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_confirmation_tokens: {
        Row: {
          appointment_id: string
          appointment_revision: number
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          idempotency_key: string | null
          last_prepared_at: string | null
          metadata: Json
          opened_at: string | null
          request_fingerprint: string | null
          revoked_at: string | null
          sent_at: string | null
          status: string
          token: string | null
          token_hash: string | null
          used_at: string | null
        }
        Insert: {
          appointment_id: string
          appointment_revision: number
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          idempotency_key?: string | null
          last_prepared_at?: string | null
          metadata?: Json
          opened_at?: string | null
          request_fingerprint?: string | null
          revoked_at?: string | null
          sent_at?: string | null
          status?: string
          token?: string | null
          token_hash?: string | null
          used_at?: string | null
        }
        Update: {
          appointment_id?: string
          appointment_revision?: number
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          idempotency_key?: string | null
          last_prepared_at?: string | null
          metadata?: Json
          opened_at?: string | null
          request_fingerprint?: string | null
          revoked_at?: string | null
          sent_at?: string | null
          status?: string
          token?: string | null
          token_hash?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_confirmation_tokens_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_events: {
        Row: {
          action_origin: string
          actor_type: string
          actor_user_id: string | null
          appointment_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          patient_id: string | null
          psychologist_id: string
          to_status: string | null
        }
        Insert: {
          action_origin?: string
          actor_type?: string
          actor_user_id?: string | null
          appointment_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          patient_id?: string | null
          psychologist_id: string
          to_status?: string | null
        }
        Update: {
          action_origin?: string
          actor_type?: string
          actor_user_id?: string | null
          appointment_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          patient_id?: string | null
          psychologist_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_exceptions: {
        Row: {
          created_at: string | null
          exception_type: string
          id: string
          new_appointment_id: string | null
          original_date: string
          recurring_id: string
        }
        Insert: {
          created_at?: string | null
          exception_type: string
          id?: string
          new_appointment_id?: string | null
          original_date: string
          recurring_id: string
        }
        Update: {
          created_at?: string | null
          exception_type?: string
          id?: string
          new_appointment_id?: string | null
          original_date?: string
          recurring_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_exceptions_new_appointment_id_fkey"
            columns: ["new_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_exceptions_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_financial_coverages: {
        Row: {
          appointment_id: string
          binding_id: string
          covered_at: string
          created_at: string
          financial_entry_id: string | null
          id: string
          idempotency_key: string
          package_id: string
          patient_id: string
          payment_id: string | null
          professional_id: string
          reason: string | null
          released_at: string | null
          replaced_by_coverage_id: string | null
          source: string
          status: string
        }
        Insert: {
          appointment_id: string
          binding_id: string
          covered_at?: string
          created_at?: string
          financial_entry_id?: string | null
          id?: string
          idempotency_key: string
          package_id: string
          patient_id: string
          payment_id?: string | null
          professional_id: string
          reason?: string | null
          released_at?: string | null
          replaced_by_coverage_id?: string | null
          source?: string
          status?: string
        }
        Update: {
          appointment_id?: string
          binding_id?: string
          covered_at?: string
          created_at?: string
          financial_entry_id?: string | null
          id?: string
          idempotency_key?: string
          package_id?: string
          patient_id?: string
          payment_id?: string | null
          professional_id?: string
          reason?: string | null
          released_at?: string | null
          replaced_by_coverage_id?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_financial_coverages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_financial_coverages_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: false
            referencedRelation: "appointment_package_bindings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_financial_coverages_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_financial_coverages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_financial_coverages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_financial_coverages_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "nb_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_financial_coverages_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "nb_payments_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_financial_coverages_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_chargebacks_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_financial_coverages_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_charges_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_financial_coverages_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_eligible_anticipation_payments_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_financial_coverages_replaced_by_fkey"
            columns: ["replaced_by_coverage_id"]
            isOneToOne: false
            referencedRelation: "appointment_financial_coverages"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_occurrence_overrides: {
        Row: {
          action_plan_id: string | null
          appointment_id: string | null
          changed_fields: string[]
          created_at: string
          created_by: string | null
          id: string
          occurrence_number: number
          original_values: Json
          override_values: Json
          professional_id: string
          reason: string | null
          series_id: string
          source: string
        }
        Insert: {
          action_plan_id?: string | null
          appointment_id?: string | null
          changed_fields: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          occurrence_number: number
          original_values?: Json
          override_values: Json
          professional_id: string
          reason?: string | null
          series_id: string
          source?: string
        }
        Update: {
          action_plan_id?: string | null
          appointment_id?: string | null
          changed_fields?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          occurrence_number?: number
          original_values?: Json
          override_values?: Json
          professional_id?: string
          reason?: string | null
          series_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_occurrence_overrides_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_occurrence_overrides_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "appointment_series"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_outcome_override_requests: {
        Row: {
          action_origin: string
          appointment_id: string
          created_at: string
          evidence: Json
          id: string
          idempotency_key: string
          patient_right_status: string
          policy_snapshot_id: string | null
          psychologist_id: string
          reason: string
          request_fingerprint: string
          requested_by: string | null
          requested_clinical_outcome: string | null
          requested_financial_outcome: string | null
          requested_status: string | null
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          action_origin?: string
          appointment_id: string
          created_at?: string
          evidence?: Json
          id?: string
          idempotency_key: string
          patient_right_status: string
          policy_snapshot_id?: string | null
          psychologist_id: string
          reason: string
          request_fingerprint: string
          requested_by?: string | null
          requested_clinical_outcome?: string | null
          requested_financial_outcome?: string | null
          requested_status?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          action_origin?: string
          appointment_id?: string
          created_at?: string
          evidence?: Json
          id?: string
          idempotency_key?: string
          patient_right_status?: string
          policy_snapshot_id?: string | null
          psychologist_id?: string
          reason?: string
          request_fingerprint?: string
          requested_by?: string | null
          requested_clinical_outcome?: string | null
          requested_financial_outcome?: string | null
          requested_status?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_outcome_override_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_outcome_override_requests_policy_snapshot_id_fkey"
            columns: ["policy_snapshot_id"]
            isOneToOne: false
            referencedRelation: "appointment_policy_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_package_bindings: {
        Row: {
          appointment_id: string
          bound_at: string
          consumed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string
          package_id: string
          patient_id: string
          professional_id: string
          reason: string | null
          released_at: string | null
          replaced_by_binding_id: string | null
          series_id: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          bound_at?: string
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key: string
          package_id: string
          patient_id: string
          professional_id: string
          reason?: string | null
          released_at?: string | null
          replaced_by_binding_id?: string | null
          series_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          bound_at?: string
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string
          package_id?: string
          patient_id?: string
          professional_id?: string
          reason?: string | null
          released_at?: string | null
          replaced_by_binding_id?: string | null
          series_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_package_bindings_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_package_bindings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_package_bindings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_package_bindings_replaced_by_fkey"
            columns: ["replaced_by_binding_id"]
            isOneToOne: false
            referencedRelation: "appointment_package_bindings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_package_bindings_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "appointment_series"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_policy_application_operations: {
        Row: {
          appointment_ids: string[]
          created_at: string
          id: string
          idempotency_key: string
          policy_version_id: string
          psychologist_id: string
          reason: string
          request_fingerprint: string
          result: Json
          status: string
        }
        Insert: {
          appointment_ids: string[]
          created_at?: string
          id?: string
          idempotency_key: string
          policy_version_id: string
          psychologist_id: string
          reason: string
          request_fingerprint: string
          result?: Json
          status?: string
        }
        Update: {
          appointment_ids?: string[]
          created_at?: string
          id?: string
          idempotency_key?: string
          policy_version_id?: string
          psychologist_id?: string
          reason?: string
          request_fingerprint?: string
          result?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_policy_application_operation_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "appointment_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_policy_snapshots: {
        Row: {
          appointment_end_time: string
          appointment_id: string
          appointment_revision: number
          appointment_start_time: string
          charge_policy: string
          created_at: string
          fiscal_policy: string
          free_cancellation_cutoff_at: string
          free_cancellation_hours: number
          free_reschedule_cutoff_at: string
          free_reschedule_hours: number
          id: string
          late_cancellation_consequence: string
          metadata: Json
          minimum_patient_reaction_hours: number
          no_show_consequence: string
          package_credit_policy: string
          policy_version: number
          policy_version_id: string | null
          predicted_financial_consequence: string
          professional_no_response_behavior: string
          professional_response_sla_hours: number
          snapshot_sequence: number
          source: string
          timezone: string
        }
        Insert: {
          appointment_end_time: string
          appointment_id: string
          appointment_revision: number
          appointment_start_time: string
          charge_policy: string
          created_at?: string
          fiscal_policy: string
          free_cancellation_cutoff_at: string
          free_cancellation_hours: number
          free_reschedule_cutoff_at: string
          free_reschedule_hours: number
          id?: string
          late_cancellation_consequence: string
          metadata?: Json
          minimum_patient_reaction_hours: number
          no_show_consequence: string
          package_credit_policy: string
          policy_version: number
          policy_version_id?: string | null
          predicted_financial_consequence: string
          professional_no_response_behavior: string
          professional_response_sla_hours: number
          snapshot_sequence: number
          source: string
          timezone: string
        }
        Update: {
          appointment_end_time?: string
          appointment_id?: string
          appointment_revision?: number
          appointment_start_time?: string
          charge_policy?: string
          created_at?: string
          fiscal_policy?: string
          free_cancellation_cutoff_at?: string
          free_cancellation_hours?: number
          free_reschedule_cutoff_at?: string
          free_reschedule_hours?: number
          id?: string
          late_cancellation_consequence?: string
          metadata?: Json
          minimum_patient_reaction_hours?: number
          no_show_consequence?: string
          package_credit_policy?: string
          policy_version?: number
          policy_version_id?: string | null
          predicted_financial_consequence?: string
          professional_no_response_behavior?: string
          professional_response_sla_hours?: number
          snapshot_sequence?: number
          source?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_policy_snapshots_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_policy_snapshots_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "appointment_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_policy_versions: {
        Row: {
          charge_policy: string
          created_at: string
          created_by: string | null
          effective_at: string
          fiscal_policy: string
          free_cancellation_hours: number
          free_reschedule_hours: number
          id: string
          idempotency_key: string | null
          late_cancellation_consequence: string
          metadata: Json
          minimum_patient_reaction_hours: number
          no_show_consequence: string
          package_credit_policy: string
          professional_no_response_behavior: string
          professional_response_sla_hours: number
          psychologist_id: string
          request_fingerprint: string | null
          source: string
          timezone: string
          version: number
        }
        Insert: {
          charge_policy?: string
          created_at?: string
          created_by?: string | null
          effective_at?: string
          fiscal_policy?: string
          free_cancellation_hours?: number
          free_reschedule_hours?: number
          id?: string
          idempotency_key?: string | null
          late_cancellation_consequence?: string
          metadata?: Json
          minimum_patient_reaction_hours?: number
          no_show_consequence?: string
          package_credit_policy?: string
          professional_no_response_behavior?: string
          professional_response_sla_hours?: number
          psychologist_id: string
          request_fingerprint?: string | null
          source?: string
          timezone?: string
          version: number
        }
        Update: {
          charge_policy?: string
          created_at?: string
          created_by?: string | null
          effective_at?: string
          fiscal_policy?: string
          free_cancellation_hours?: number
          free_reschedule_hours?: number
          id?: string
          idempotency_key?: string | null
          late_cancellation_consequence?: string
          metadata?: Json
          minimum_patient_reaction_hours?: number
          no_show_consequence?: string
          package_credit_policy?: string
          professional_no_response_behavior?: string
          professional_response_sla_hours?: number
          psychologist_id?: string
          request_fingerprint?: string | null
          source?: string
          timezone?: string
          version?: number
        }
        Relationships: []
      }
      appointment_professional_action_operations: {
        Row: {
          action: string
          appointment_id: string
          created_at: string
          id: string
          idempotency_key: string
          psychologist_id: string
          reason: string
          request_fingerprint: string
          result: Json
          status: string
        }
        Insert: {
          action: string
          appointment_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          psychologist_id: string
          reason: string
          request_fingerprint: string
          result?: Json
          status?: string
        }
        Update: {
          action?: string
          appointment_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          psychologist_id?: string
          reason?: string
          request_fingerprint?: string
          result?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_professional_action_operations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reschedule_requests: {
        Row: {
          appointment_id: string
          appointment_revision: number
          created_at: string
          expired_without_response_at: string | null
          financial_right_protected: boolean
          id: string
          metadata: Json
          original_end_time: string
          original_start_time: string
          patient_id: string | null
          policy_snapshot_id: string | null
          professional_response_due_at: string | null
          protection_reason: string | null
          psychologist_id: string
          reaction_due_at: string | null
          reason: string | null
          requested_at: string
          requested_by_user_id: string | null
          requested_end_time: string
          requested_start_time: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seconds_remaining_at_request: number | null
          status: string
          updated_at: string
          within_free_window: boolean
        }
        Insert: {
          appointment_id: string
          appointment_revision: number
          created_at?: string
          expired_without_response_at?: string | null
          financial_right_protected?: boolean
          id?: string
          metadata?: Json
          original_end_time: string
          original_start_time: string
          patient_id?: string | null
          policy_snapshot_id?: string | null
          professional_response_due_at?: string | null
          protection_reason?: string | null
          psychologist_id: string
          reaction_due_at?: string | null
          reason?: string | null
          requested_at: string
          requested_by_user_id?: string | null
          requested_end_time: string
          requested_start_time: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seconds_remaining_at_request?: number | null
          status?: string
          updated_at?: string
          within_free_window: boolean
        }
        Update: {
          appointment_id?: string
          appointment_revision?: number
          created_at?: string
          expired_without_response_at?: string | null
          financial_right_protected?: boolean
          id?: string
          metadata?: Json
          original_end_time?: string
          original_start_time?: string
          patient_id?: string | null
          policy_snapshot_id?: string | null
          professional_response_due_at?: string | null
          protection_reason?: string | null
          psychologist_id?: string
          reaction_due_at?: string | null
          reason?: string | null
          requested_at?: string
          requested_by_user_id?: string | null
          requested_end_time?: string
          requested_start_time?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seconds_remaining_at_request?: number | null
          status?: string
          updated_at?: string
          within_free_window?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reschedule_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reschedule_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reschedule_requests_policy_snapshot_id_fkey"
            columns: ["policy_snapshot_id"]
            isOneToOne: false
            referencedRelation: "appointment_policy_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reschedule_requests_snapshot_coherence_fkey"
            columns: [
              "policy_snapshot_id",
              "appointment_id",
              "appointment_revision",
            ]
            isOneToOne: false
            referencedRelation: "appointment_policy_snapshots"
            referencedColumns: ["id", "appointment_id", "appointment_revision"]
          },
        ]
      }
      appointment_series: {
        Row: {
          appointment_type: string
          availability_version_id: string | null
          created_at: string
          created_by: string | null
          default_config: Json
          duration_minutes: number
          financial_snapshot: Json
          first_start_time: string
          frequency: string
          id: string
          last_start_time: string | null
          materialized_through: string | null
          next_generation_at: string | null
          patient_id: string | null
          psychologist_id: string
          recurrence_rule: Json
          revision: number
          rule_kind: string
          status: string
          template_version_id: string | null
          termination_kind: string
          timezone: string
          total_occurrences: number | null
          until_date: string | null
          updated_at: string
        }
        Insert: {
          appointment_type: string
          availability_version_id?: string | null
          created_at?: string
          created_by?: string | null
          default_config?: Json
          duration_minutes: number
          financial_snapshot?: Json
          first_start_time: string
          frequency: string
          id?: string
          last_start_time?: string | null
          materialized_through?: string | null
          next_generation_at?: string | null
          patient_id?: string | null
          psychologist_id: string
          recurrence_rule?: Json
          revision?: number
          rule_kind?: string
          status?: string
          template_version_id?: string | null
          termination_kind?: string
          timezone?: string
          total_occurrences?: number | null
          until_date?: string | null
          updated_at?: string
        }
        Update: {
          appointment_type?: string
          availability_version_id?: string | null
          created_at?: string
          created_by?: string | null
          default_config?: Json
          duration_minutes?: number
          financial_snapshot?: Json
          first_start_time?: string
          frequency?: string
          id?: string
          last_start_time?: string | null
          materialized_through?: string | null
          next_generation_at?: string | null
          patient_id?: string | null
          psychologist_id?: string
          recurrence_rule?: Json
          revision?: number
          rule_kind?: string
          status?: string
          template_version_id?: string | null
          termination_kind?: string
          timezone?: string
          total_occurrences?: number | null
          until_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_series_availability_version_id_fkey"
            columns: ["availability_version_id"]
            isOneToOne: false
            referencedRelation: "professional_availability_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_series_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_series_psychologist_id_fkey"
            columns: ["psychologist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_series_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "appointment_series_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_series_materialization_conflicts: {
        Row: {
          created_at: string
          id: string
          occurrence_number: number
          professional_id: string
          proposed_end_time: string
          proposed_start_time: string
          reason_code: string
          resolution_action_plan_id: string | null
          resolved_at: string | null
          safe_details: Json
          series_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          occurrence_number: number
          professional_id: string
          proposed_end_time: string
          proposed_start_time: string
          reason_code: string
          resolution_action_plan_id?: string | null
          resolved_at?: string | null
          safe_details?: Json
          series_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          occurrence_number?: number
          professional_id?: string
          proposed_end_time?: string
          proposed_start_time?: string
          reason_code?: string
          resolution_action_plan_id?: string | null
          resolved_at?: string | null
          safe_details?: Json
          series_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_series_materialization_conflicts_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "appointment_series"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_series_template_versions: {
        Row: {
          created_at: string
          created_by: string | null
          default_config: Json
          id: string
          professional_id: string
          recurrence_rule: Json
          template_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_config?: Json
          id?: string
          professional_id: string
          recurrence_rule: Json
          template_id: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_config?: Json
          id?: string
          professional_id?: string
          recurrence_rule?: Json
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointment_series_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "appointment_series_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_series_templates: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          name: string
          professional_id: string
          source_patient_id: string | null
          source_series_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          professional_id: string
          source_patient_id?: string | null
          source_series_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          professional_id?: string
          source_patient_id?: string | null
          source_series_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_series_templates_source_patient_id_fkey"
            columns: ["source_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_series_templates_source_series_id_fkey"
            columns: ["source_series_id"]
            isOneToOne: false
            referencedRelation: "appointment_series"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_slot_holds: {
        Row: {
          created_at: string
          ends_at: string
          expires_at: string
          id: string
          idempotency_key: string
          patient_id: string | null
          professional_id: string
          released_at: string | null
          starts_at: string
          status: string
          waitlist_entry_id: string | null
        }
        Insert: {
          created_at?: string
          ends_at: string
          expires_at: string
          id?: string
          idempotency_key: string
          patient_id?: string | null
          professional_id: string
          released_at?: string | null
          starts_at: string
          status?: string
          waitlist_entry_id?: string | null
        }
        Update: {
          created_at?: string
          ends_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          patient_id?: string | null
          professional_id?: string
          released_at?: string | null
          starts_at?: string
          status?: string
          waitlist_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_slot_holds_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slot_holds_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "professional_waitlist_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          action_origin: string
          archive_origin: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          audit_metadata: Json
          auth_code: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          change_responsibility: string
          charge_id: string | null
          clinical_outcome: string
          confirmation_revision: number
          confirmed_at: string | null
          confirmed_revision: number | null
          created_at: string | null
          created_by: string | null
          end_time: string | null
          financial_entry_id: string | null
          financial_launch_id: string | null
          financial_outcome: string
          financial_protection_reason: string | null
          google_event_id: string | null
          google_meet_link: string | null
          id: string
          invitation_opened_at: string | null
          invitation_sent_at: string | null
          last_actor_type: string
          lifecycle_status: string
          location: string | null
          metadata: Json | null
          notes: string | null
          occurrence_count: number | null
          occurrence_number: number | null
          occurrence_status: string
          outcome_review_required: boolean
          package_id: string | null
          patient_action_due_at: string | null
          patient_id: string | null
          patient_right_status: string
          payment_config: Json | null
          payment_status: string
          personalized_fields: string[]
          policy_snapshot_id: string | null
          previous_status: string | null
          price: number | null
          professional_response_due_at: string | null
          reschedule_approved_at: string | null
          reschedule_rejected_at: string | null
          reschedule_requested_at: string | null
          series_id: string | null
          series_revision: number | null
          start_time: string | null
          status: string | null
          token: string | null
          type: string
          updated_at: string
          updated_by: string | null
          user_id: string
          visibility_status: string
        }
        Insert: {
          action_origin?: string
          archive_origin?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          audit_metadata?: Json
          auth_code?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          change_responsibility?: string
          charge_id?: string | null
          clinical_outcome?: string
          confirmation_revision?: number
          confirmed_at?: string | null
          confirmed_revision?: number | null
          created_at?: string | null
          created_by?: string | null
          end_time?: string | null
          financial_entry_id?: string | null
          financial_launch_id?: string | null
          financial_outcome?: string
          financial_protection_reason?: string | null
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          invitation_opened_at?: string | null
          invitation_sent_at?: string | null
          last_actor_type?: string
          lifecycle_status?: string
          location?: string | null
          metadata?: Json | null
          notes?: string | null
          occurrence_count?: number | null
          occurrence_number?: number | null
          occurrence_status?: string
          outcome_review_required?: boolean
          package_id?: string | null
          patient_action_due_at?: string | null
          patient_id?: string | null
          patient_right_status?: string
          payment_config?: Json | null
          payment_status?: string
          personalized_fields?: string[]
          policy_snapshot_id?: string | null
          previous_status?: string | null
          price?: number | null
          professional_response_due_at?: string | null
          reschedule_approved_at?: string | null
          reschedule_rejected_at?: string | null
          reschedule_requested_at?: string | null
          series_id?: string | null
          series_revision?: number | null
          start_time?: string | null
          status?: string | null
          token?: string | null
          type: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
          visibility_status?: string
        }
        Update: {
          action_origin?: string
          archive_origin?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          audit_metadata?: Json
          auth_code?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          change_responsibility?: string
          charge_id?: string | null
          clinical_outcome?: string
          confirmation_revision?: number
          confirmed_at?: string | null
          confirmed_revision?: number | null
          created_at?: string | null
          created_by?: string | null
          end_time?: string | null
          financial_entry_id?: string | null
          financial_launch_id?: string | null
          financial_outcome?: string
          financial_protection_reason?: string | null
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          invitation_opened_at?: string | null
          invitation_sent_at?: string | null
          last_actor_type?: string
          lifecycle_status?: string
          location?: string | null
          metadata?: Json | null
          notes?: string | null
          occurrence_count?: number | null
          occurrence_number?: number | null
          occurrence_status?: string
          outcome_review_required?: boolean
          package_id?: string | null
          patient_action_due_at?: string | null
          patient_id?: string | null
          patient_right_status?: string
          payment_config?: Json | null
          payment_status?: string
          personalized_fields?: string[]
          policy_snapshot_id?: string | null
          previous_status?: string | null
          price?: number | null
          professional_response_due_at?: string | null
          reschedule_approved_at?: string | null
          reschedule_rejected_at?: string | null
          reschedule_requested_at?: string | null
          series_id?: string | null
          series_revision?: number | null
          start_time?: string | null
          status?: string | null
          token?: string | null
          type?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          visibility_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "nb_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "nb_payments_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_chargebacks_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_charges_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_eligible_anticipation_payments_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_policy_snapshot_id_fkey"
            columns: ["policy_snapshot_id"]
            isOneToOne: false
            referencedRelation: "appointment_policy_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "appointment_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhook_events: {
        Row: {
          asaas_account_id: string | null
          created_at: string | null
          error_message: string | null
          event_id: string
          event_received_at: string | null
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
          provider_object_id: string | null
          provider_object_type: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          asaas_account_id?: string | null
          created_at?: string | null
          error_message?: string | null
          event_id: string
          event_received_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider_object_id?: string | null
          provider_object_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          asaas_account_id?: string | null
          created_at?: string | null
          error_message?: string | null
          event_id?: string
          event_received_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider_object_id?: string | null
          provider_object_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          current_hash: string | null
          details: Json | null
          id: string
          ip_address: string | null
          previous_hash: string | null
          resource: string
          resource_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          current_hash?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          previous_hash?: string | null
          resource: string
          resource_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          current_hash?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          previous_hash?: string | null
          resource?: string
          resource_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          context_state: Json
          created_at: string
          id: string
          memory_summary: string | null
          memory_updated_at: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context_state?: Json
          created_at?: string
          id?: string
          memory_summary?: string | null
          memory_updated_at?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context_state?: Json
          created_at?: string
          id?: string
          memory_summary?: string | null
          memory_updated_at?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      communication_templates: {
        Row: {
          body_html: string
          created_at: string | null
          id: string
          subject: string
          template_key: string
          user_id: string
        }
        Insert: {
          body_html: string
          created_at?: string | null
          id?: string
          subject: string
          template_key: string
          user_id: string
        }
        Update: {
          body_html?: string
          created_at?: string | null
          id?: string
          subject?: string
          template_key?: string
          user_id?: string
        }
        Relationships: []
      }
      document_files: {
        Row: {
          bucket: string
          category: string
          checksum_sha256: string | null
          created_at: string
          deleted_at: string | null
          id: string
          metadata: Json
          mime_type: string
          object_key: string
          original_name: string
          patient_id: string | null
          provider: string
          shared_with_patient: boolean
          shared_with_patient_at: string | null
          shared_with_patient_by: string | null
          size_bytes: number
          status: string
          updated_at: string
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          bucket: string
          category?: string
          checksum_sha256?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json
          mime_type: string
          object_key: string
          original_name: string
          patient_id?: string | null
          provider?: string
          shared_with_patient?: boolean
          shared_with_patient_at?: string | null
          shared_with_patient_by?: string | null
          size_bytes?: number
          status?: string
          updated_at?: string
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          bucket?: string
          category?: string
          checksum_sha256?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json
          mime_type?: string
          object_key?: string
          original_name?: string
          patient_id?: string | null
          provider?: string
          shared_with_patient?: boolean
          shared_with_patient_at?: string | null
          shared_with_patient_by?: string | null
          size_bytes?: number
          status?: string
          updated_at?: string
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_files_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string | null
          created_at: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      email_delivery_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          metadata: Json
          notification_id: string | null
          provider: string
          provider_message_id: string | null
          recipient: string
          sender: string
          status: string
          template_key: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          notification_id?: string | null
          provider: string
          provider_message_id?: string | null
          recipient: string
          sender: string
          status: string
          template_key?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          notification_id?: string | null
          provider?: string
          provider_message_id?: string | null
          recipient?: string
          sender?: string
          status?: string
          template_key?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_postal_code: string | null
          address_state: string | null
          address_street: string | null
          asaas_account_id: string | null
          asaas_environment: string
          asaas_onboarding_url: string | null
          asaas_privacy_policy_reference: string | null
          asaas_terms_reference: string | null
          asaas_wallet_id: string | null
          bank_account: string | null
          bank_account_digit: string | null
          bank_account_last4: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_code: string | null
          bank_holder_cpf_cnpj: string | null
          bank_holder_name: string | null
          bank_name: string | null
          birth_date: string | null
          business_description: string | null
          business_mcc: string | null
          business_url: string | null
          card_enabled: boolean | null
          charges_enabled: boolean | null
          company_type: string | null
          cpf_cnpj: string | null
          created_at: string | null
          default_currency: string | null
          details_submitted: boolean | null
          document_back_id: string | null
          document_front_id: string | null
          holder_name: string | null
          id: string
          income_value: number | null
          last_asaas_event_at: string | null
          last_asaas_event_type: string | null
          last_balance_sync_at: string | null
          last_sync_error: string | null
          metadata: Json | null
          mobile_phone: string | null
          neuronex_terms_version: string | null
          onboarding_completed_at: string | null
          onboarding_payload: Json
          onboarding_started_at: string | null
          payouts_enabled: boolean | null
          pep_status: string | null
          pix_enabled: boolean | null
          pix_key_consent_at: string | null
          platform_fee_fixed: number | null
          platform_fee_percent: number | null
          provider: string
          requirements: Json | null
          status: string
          tos_accepted_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          asaas_account_id?: string | null
          asaas_environment?: string
          asaas_onboarding_url?: string | null
          asaas_privacy_policy_reference?: string | null
          asaas_terms_reference?: string | null
          asaas_wallet_id?: string | null
          bank_account?: string | null
          bank_account_digit?: string | null
          bank_account_last4?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          bank_holder_cpf_cnpj?: string | null
          bank_holder_name?: string | null
          bank_name?: string | null
          birth_date?: string | null
          business_description?: string | null
          business_mcc?: string | null
          business_url?: string | null
          card_enabled?: boolean | null
          charges_enabled?: boolean | null
          company_type?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          default_currency?: string | null
          details_submitted?: boolean | null
          document_back_id?: string | null
          document_front_id?: string | null
          holder_name?: string | null
          id?: string
          income_value?: number | null
          last_asaas_event_at?: string | null
          last_asaas_event_type?: string | null
          last_balance_sync_at?: string | null
          last_sync_error?: string | null
          metadata?: Json | null
          mobile_phone?: string | null
          neuronex_terms_version?: string | null
          onboarding_completed_at?: string | null
          onboarding_payload?: Json
          onboarding_started_at?: string | null
          payouts_enabled?: boolean | null
          pep_status?: string | null
          pix_enabled?: boolean | null
          pix_key_consent_at?: string | null
          platform_fee_fixed?: number | null
          platform_fee_percent?: number | null
          provider?: string
          requirements?: Json | null
          status?: string
          tos_accepted_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          asaas_account_id?: string | null
          asaas_environment?: string
          asaas_onboarding_url?: string | null
          asaas_privacy_policy_reference?: string | null
          asaas_terms_reference?: string | null
          asaas_wallet_id?: string | null
          bank_account?: string | null
          bank_account_digit?: string | null
          bank_account_last4?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          bank_holder_cpf_cnpj?: string | null
          bank_holder_name?: string | null
          bank_name?: string | null
          birth_date?: string | null
          business_description?: string | null
          business_mcc?: string | null
          business_url?: string | null
          card_enabled?: boolean | null
          charges_enabled?: boolean | null
          company_type?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          default_currency?: string | null
          details_submitted?: boolean | null
          document_back_id?: string | null
          document_front_id?: string | null
          holder_name?: string | null
          id?: string
          income_value?: number | null
          last_asaas_event_at?: string | null
          last_asaas_event_type?: string | null
          last_balance_sync_at?: string | null
          last_sync_error?: string | null
          metadata?: Json | null
          mobile_phone?: string | null
          neuronex_terms_version?: string | null
          onboarding_completed_at?: string | null
          onboarding_payload?: Json
          onboarding_started_at?: string | null
          payouts_enabled?: boolean | null
          pep_status?: string | null
          pix_enabled?: boolean | null
          pix_key_consent_at?: string | null
          platform_fee_fixed?: number | null
          platform_fee_percent?: number | null
          provider?: string
          requirements?: Json | null
          status?: string
          tos_accepted_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      financial_automation_settings: {
        Row: {
          appointment_auto_create_enabled: boolean
          appointment_default_amount: number | null
          appointment_default_category_id: string | null
          appointment_due_days: number
          attended_status_moves_to_pending: boolean
          clinic_id: string | null
          created_at: string
          id: string
          metadata: Json
          professional_id: string
          updated_at: string
        }
        Insert: {
          appointment_auto_create_enabled?: boolean
          appointment_default_amount?: number | null
          appointment_default_category_id?: string | null
          appointment_due_days?: number
          attended_status_moves_to_pending?: boolean
          clinic_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          professional_id: string
          updated_at?: string
        }
        Update: {
          appointment_auto_create_enabled?: boolean
          appointment_default_amount?: number | null
          appointment_default_category_id?: string | null
          appointment_due_days?: number
          attended_status_moves_to_pending?: boolean
          clinic_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          professional_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_automation_settings_appointment_default_category_fkey"
            columns: ["appointment_default_category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          clinic_id: string | null
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_default: boolean
          name: string
          professional_id: string
          type: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          professional_id: string
          type: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          professional_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          amount: number
          appointment_id: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          category_id: string | null
          clinic_id: string | null
          competence_date: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          neurofinance_charge_id: string | null
          neurofinance_transaction_id: string | null
          origin: string
          paid_at: string | null
          patient_id: string | null
          payment_method: string
          professional_id: string
          reversal_of_entry_id: string | null
          reversal_reason: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          category_id?: string | null
          clinic_id?: string | null
          competence_date?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          neurofinance_charge_id?: string | null
          neurofinance_transaction_id?: string | null
          origin?: string
          paid_at?: string | null
          patient_id?: string | null
          payment_method?: string
          professional_id: string
          reversal_of_entry_id?: string | null
          reversal_reason?: string | null
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          category_id?: string | null
          clinic_id?: string | null
          competence_date?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          neurofinance_charge_id?: string | null
          neurofinance_transaction_id?: string | null
          origin?: string
          paid_at?: string | null
          patient_id?: string | null
          payment_method?: string
          professional_id?: string
          reversal_of_entry_id?: string | null
          reversal_reason?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_neurofinance_charge_id_fkey"
            columns: ["neurofinance_charge_id"]
            isOneToOne: false
            referencedRelation: "nb_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_neurofinance_charge_id_fkey"
            columns: ["neurofinance_charge_id"]
            isOneToOne: false
            referencedRelation: "nb_payments_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_neurofinance_charge_id_fkey"
            columns: ["neurofinance_charge_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_chargebacks_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_neurofinance_charge_id_fkey"
            columns: ["neurofinance_charge_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_charges_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_neurofinance_charge_id_fkey"
            columns: ["neurofinance_charge_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_eligible_anticipation_payments_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_reversal_of_entry_id_fkey"
            columns: ["reversal_of_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entry_settlements: {
        Row: {
          amount: number
          created_at: string
          financial_entry_id: string
          id: string
          idempotency_key: string
          metadata: Json
          payment_method: string
          professional_id: string
          reversal_reason: string | null
          reversed_at: string | null
          settled_at: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          financial_entry_id: string
          id?: string
          idempotency_key: string
          metadata?: Json
          payment_method?: string
          professional_id: string
          reversal_reason?: string | null
          reversed_at?: string | null
          settled_at: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          financial_entry_id?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          payment_method?: string
          professional_id?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          settled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entry_settlements_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_planning_goals: {
        Row: {
          created_at: string
          desired_profit_cents: number
          expense_limit_cents: number
          id: string
          month: string
          notes: string | null
          professional_id: string
          revenue_goal_cents: number
          target_sessions: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          desired_profit_cents?: number
          expense_limit_cents?: number
          id?: string
          month: string
          notes?: string | null
          professional_id: string
          revenue_goal_cents?: number
          target_sessions?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          desired_profit_cents?: number
          expense_limit_cents?: number
          id?: string
          month?: string
          notes?: string | null
          professional_id?: string
          revenue_goal_cents?: number
          target_sessions?: number
          updated_at?: string
        }
        Relationships: []
      }
      financial_reconciliations: {
        Row: {
          clinic_id: string | null
          confidence_score: number | null
          created_at: string
          financial_entry_id: string
          id: string
          idempotency_key: string | null
          matched_at: string
          matched_by: string
          metadata: Json
          neurofinance_charge_id: string | null
          neurofinance_transaction_id: string | null
          notes: string | null
          professional_id: string
        }
        Insert: {
          clinic_id?: string | null
          confidence_score?: number | null
          created_at?: string
          financial_entry_id: string
          id?: string
          idempotency_key?: string | null
          matched_at?: string
          matched_by: string
          metadata?: Json
          neurofinance_charge_id?: string | null
          neurofinance_transaction_id?: string | null
          notes?: string | null
          professional_id: string
        }
        Update: {
          clinic_id?: string | null
          confidence_score?: number | null
          created_at?: string
          financial_entry_id?: string
          id?: string
          idempotency_key?: string | null
          matched_at?: string
          matched_by?: string
          metadata?: Json
          neurofinance_charge_id?: string | null
          neurofinance_transaction_id?: string | null
          notes?: string | null
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_reconciliations_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_reconciliations_neurofinance_charge_id_fkey"
            columns: ["neurofinance_charge_id"]
            isOneToOne: false
            referencedRelation: "nb_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_reconciliations_neurofinance_charge_id_fkey"
            columns: ["neurofinance_charge_id"]
            isOneToOne: false
            referencedRelation: "nb_payments_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_reconciliations_neurofinance_charge_id_fkey"
            columns: ["neurofinance_charge_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_chargebacks_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_reconciliations_neurofinance_charge_id_fkey"
            columns: ["neurofinance_charge_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_charges_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_reconciliations_neurofinance_charge_id_fkey"
            columns: ["neurofinance_charge_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_eligible_anticipation_payments_v"
            referencedColumns: ["id"]
          },
        ]
      }
      history_conversation_psychology: {
        Row: {
          conversation_history: Json | null
          id: number
          professional_id: string | null
          remoteJid: string | null
          timestamp: string | null
        }
        Insert: {
          conversation_history?: Json | null
          id?: number
          professional_id?: string | null
          remoteJid?: string | null
          timestamp?: string | null
        }
        Update: {
          conversation_history?: Json | null
          id?: number
          professional_id?: string | null
          remoteJid?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      integration_suggestions: {
        Row: {
          created_at: string
          id: string
          status: string
          suggestion: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          suggestion: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          suggestion?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_automation: {
        Row: {
          auto_issue_enabled: boolean | null
          created_at: string | null
          default_service_code: string | null
          default_tax_regime: string | null
          id: string
          issue_on_payment_confirmation: boolean | null
          metadata: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_issue_enabled?: boolean | null
          created_at?: string | null
          default_service_code?: string | null
          default_tax_regime?: string | null
          id?: string
          issue_on_payment_confirmation?: boolean | null
          metadata?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_issue_enabled?: boolean | null
          created_at?: string | null
          default_service_code?: string | null
          default_tax_regime?: string | null
          id?: string
          issue_on_payment_confirmation?: boolean | null
          metadata?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string
          nfse_authorized_at: string | null
          nfse_error_message: string | null
          nfse_number: string | null
          nfse_payload: Json
          nfse_pdf_url: string | null
          nfse_provider: string | null
          nfse_ref: string | null
          nfse_reference: string | null
          nfse_status: string | null
          nfse_status_description: string | null
          nfse_synced_at: string | null
          nfse_verification_code: string | null
          nfse_xml_url: string | null
          patient_id: string | null
          payment_method: string | null
          payment_methods: string[] | null
          payment_url: string | null
          pdf_url: string | null
          pix_copy_paste: string | null
          pix_qrcode: string | null
          preferred_method: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          amount: number
          asaas_payment_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          nfse_authorized_at?: string | null
          nfse_error_message?: string | null
          nfse_number?: string | null
          nfse_payload?: Json
          nfse_pdf_url?: string | null
          nfse_provider?: string | null
          nfse_ref?: string | null
          nfse_reference?: string | null
          nfse_status?: string | null
          nfse_status_description?: string | null
          nfse_synced_at?: string | null
          nfse_verification_code?: string | null
          nfse_xml_url?: string | null
          patient_id?: string | null
          payment_method?: string | null
          payment_methods?: string[] | null
          payment_url?: string | null
          pdf_url?: string | null
          pix_copy_paste?: string | null
          pix_qrcode?: string | null
          preferred_method?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          nfse_authorized_at?: string | null
          nfse_error_message?: string | null
          nfse_number?: string | null
          nfse_payload?: Json
          nfse_pdf_url?: string | null
          nfse_provider?: string | null
          nfse_ref?: string | null
          nfse_reference?: string | null
          nfse_status?: string | null
          nfse_status_description?: string | null
          nfse_synced_at?: string | null
          nfse_verification_code?: string | null
          nfse_xml_url?: string | null
          patient_id?: string | null
          payment_method?: string | null
          payment_methods?: string[] | null
          payment_url?: string | null
          pdf_url?: string | null
          pix_copy_paste?: string | null
          pix_qrcode?: string | null
          preferred_method?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          embedding: string | null
          id: string
          remoteJid: string | null
          role: string
          session_id: string
          user_id: string | null
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          remoteJid?: string | null
          role: string
          session_id: string
          user_id?: string | null
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          remoteJid?: string | null
          role?: string
          session_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      nb_payments: {
        Row: {
          actual_fee_amount: number | null
          anticipable: boolean | null
          anticipated: boolean | null
          appointment_id: string | null
          available_at: string | null
          boleto_pdf: string | null
          boleto_url: string | null
          channel: string
          checkout_url: string | null
          confirmed_at: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          dispute_amount: number | null
          dispute_id: string | null
          dispute_reason: string | null
          dispute_status: string | null
          estimated_credit_at: string | null
          estimated_fee_amount: number | null
          expires_at: string | null
          fee_rule_id: string | null
          financial_account_id: string | null
          financial_entry_id: string | null
          funds_status: string
          gross_amount: number
          id: string
          installment_id: string | null
          installments: number
          metadata: Json | null
          net_amount: number | null
          nfse_authorized_at: string | null
          nfse_error_message: string | null
          nfse_number: string | null
          nfse_payload: Json
          nfse_pdf_url: string | null
          nfse_provider: string
          nfse_reference: string | null
          nfse_status: string | null
          nfse_status_description: string | null
          nfse_synced_at: string | null
          nfse_verification_code: string | null
          nfse_xml_url: string | null
          normalized_status: string
          paid_at: string | null
          patient_id: string | null
          payment_method_type: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          platform_fee_amount: number | null
          provider: string | null
          provider_due_date: string | null
          provider_payment_id: string | null
          provider_status: string | null
          reconciled_at: string | null
          reconciliation_status: string
          refund_amount: number | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_fee_amount?: number | null
          anticipable?: boolean | null
          anticipated?: boolean | null
          appointment_id?: string | null
          available_at?: string | null
          boleto_pdf?: string | null
          boleto_url?: string | null
          channel?: string
          checkout_url?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          dispute_amount?: number | null
          dispute_id?: string | null
          dispute_reason?: string | null
          dispute_status?: string | null
          estimated_credit_at?: string | null
          estimated_fee_amount?: number | null
          expires_at?: string | null
          fee_rule_id?: string | null
          financial_account_id?: string | null
          financial_entry_id?: string | null
          funds_status?: string
          gross_amount: number
          id?: string
          installment_id?: string | null
          installments?: number
          metadata?: Json | null
          net_amount?: number | null
          nfse_authorized_at?: string | null
          nfse_error_message?: string | null
          nfse_number?: string | null
          nfse_payload?: Json
          nfse_pdf_url?: string | null
          nfse_provider?: string
          nfse_reference?: string | null
          nfse_status?: string | null
          nfse_status_description?: string | null
          nfse_synced_at?: string | null
          nfse_verification_code?: string | null
          nfse_xml_url?: string | null
          normalized_status?: string
          paid_at?: string | null
          patient_id?: string | null
          payment_method_type?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          platform_fee_amount?: number | null
          provider?: string | null
          provider_due_date?: string | null
          provider_payment_id?: string | null
          provider_status?: string | null
          reconciled_at?: string | null
          reconciliation_status?: string
          refund_amount?: number | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_fee_amount?: number | null
          anticipable?: boolean | null
          anticipated?: boolean | null
          appointment_id?: string | null
          available_at?: string | null
          boleto_pdf?: string | null
          boleto_url?: string | null
          channel?: string
          checkout_url?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          dispute_amount?: number | null
          dispute_id?: string | null
          dispute_reason?: string | null
          dispute_status?: string | null
          estimated_credit_at?: string | null
          estimated_fee_amount?: number | null
          expires_at?: string | null
          fee_rule_id?: string | null
          financial_account_id?: string | null
          financial_entry_id?: string | null
          funds_status?: string
          gross_amount?: number
          id?: string
          installment_id?: string | null
          installments?: number
          metadata?: Json | null
          net_amount?: number | null
          nfse_authorized_at?: string | null
          nfse_error_message?: string | null
          nfse_number?: string | null
          nfse_payload?: Json
          nfse_pdf_url?: string | null
          nfse_provider?: string
          nfse_reference?: string | null
          nfse_status?: string | null
          nfse_status_description?: string | null
          nfse_synced_at?: string | null
          nfse_verification_code?: string | null
          nfse_xml_url?: string | null
          normalized_status?: string
          paid_at?: string | null
          patient_id?: string | null
          payment_method_type?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          platform_fee_amount?: number | null
          provider?: string | null
          provider_due_date?: string | null
          provider_payment_id?: string | null
          provider_status?: string | null
          reconciled_at?: string | null
          reconciliation_status?: string
          refund_amount?: number | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nb_payments_fee_rule_id_fkey"
            columns: ["fee_rule_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_tariff_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payments_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      nb_payouts: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          currency: string | null
          destination_summary: string | null
          destination_type: string | null
          fee_amount: number | null
          financial_account_id: string | null
          id: string
          metadata: Json | null
          operation_type: string
          pix_key: string | null
          processed_at: string | null
          provider: string | null
          provider_payload: Json
          provider_payout_id: string | null
          provider_status: string | null
          reconciled_at: string | null
          reconciliation_status: string
          requested_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          destination_summary?: string | null
          destination_type?: string | null
          fee_amount?: number | null
          financial_account_id?: string | null
          id?: string
          metadata?: Json | null
          operation_type?: string
          pix_key?: string | null
          processed_at?: string | null
          provider?: string | null
          provider_payload?: Json
          provider_payout_id?: string | null
          provider_status?: string | null
          reconciled_at?: string | null
          reconciliation_status?: string
          requested_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          destination_summary?: string | null
          destination_type?: string | null
          fee_amount?: number | null
          financial_account_id?: string | null
          id?: string
          metadata?: Json | null
          operation_type?: string
          pix_key?: string | null
          processed_at?: string | null
          provider?: string | null
          provider_payload?: Json
          provider_payout_id?: string | null
          provider_status?: string | null
          reconciled_at?: string | null
          reconciliation_status?: string
          requested_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nb_payouts_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payouts_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payouts_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
        ]
      }
      neuro_flows: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_template: boolean
          last_accessed_at: string | null
          last_saved_at: string | null
          patient_id: string | null
          save_revision: number
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          workflow: Json
          workflow_schema_version: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_template?: boolean
          last_accessed_at?: string | null
          last_saved_at?: string | null
          patient_id?: string | null
          save_revision?: number
          tags?: string[]
          title?: string
          updated_at?: string
          user_id: string
          workflow?: Json
          workflow_schema_version?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_template?: boolean
          last_accessed_at?: string | null
          last_saved_at?: string | null
          patient_id?: string | null
          save_revision?: number
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          workflow?: Json
          workflow_schema_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "neuro_flows_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      neuroview_evidence_index: {
        Row: {
          action_completed: boolean
          action_due_at: string | null
          id: string
          is_actionable: boolean
          metadata: Json
          occurred_at: string
          patient_id: string | null
          reviewed: boolean
          source_id: string
          source_type: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_completed?: boolean
          action_due_at?: string | null
          id?: string
          is_actionable?: boolean
          metadata?: Json
          occurred_at: string
          patient_id?: string | null
          reviewed?: boolean
          source_id: string
          source_type: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_completed?: boolean
          action_due_at?: string | null
          id?: string
          is_actionable?: boolean
          metadata?: Json
          occurred_at?: string
          patient_id?: string | null
          reviewed?: boolean
          source_id?: string
          source_type?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      neuroview_evidence_overrides: {
        Row: {
          id: string
          is_hidden: boolean
          is_pinned: boolean
          priority: number
          source_id: string
          source_type: string
          theme_override: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          is_hidden?: boolean
          is_pinned?: boolean
          priority?: number
          source_id: string
          source_type: string
          theme_override?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          is_hidden?: boolean
          is_pinned?: boolean
          priority?: number
          source_id?: string
          source_type?: string
          theme_override?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      neuro_pulse_entries: {
        Row: {
          created_at: string
          data: Json
          id: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      neurofinance_account_movements: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          direction: string
          financial_account_id: string
          id: string
          metadata: Json
          movement_type: string
          occurred_at: string
          provider: string
          provider_movement_id: string | null
          reference_id: string | null
          reference_type: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          direction: string
          financial_account_id: string
          id?: string
          metadata?: Json
          movement_type: string
          occurred_at?: string
          provider?: string
          provider_movement_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          direction?: string
          financial_account_id?: string
          id?: string
          metadata?: Json
          movement_type?: string
          occurred_at?: string
          provider?: string
          provider_movement_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "neurofinance_account_movements_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_account_movements_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_account_movements_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
        ]
      }
      neurofinance_anticipations: {
        Row: {
          anticipated_amount: number
          anticipation_date: string | null
          anticipation_days: number | null
          created_at: string
          credited_at: string | null
          denial_observation: string | null
          documents: Json
          documents_required: boolean
          due_date: string | null
          fee_amount: number
          financial_account_id: string | null
          gross_amount: number
          id: string
          installment_id: string | null
          net_amount: number
          normalized_status: string
          payment_id: string | null
          provider: string
          provider_anticipation_id: string | null
          provider_payload: Json
          provider_payment_id: string | null
          provider_status: string | null
          requested_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anticipated_amount?: number
          anticipation_date?: string | null
          anticipation_days?: number | null
          created_at?: string
          credited_at?: string | null
          denial_observation?: string | null
          documents?: Json
          documents_required?: boolean
          due_date?: string | null
          fee_amount?: number
          financial_account_id?: string | null
          gross_amount?: number
          id?: string
          installment_id?: string | null
          net_amount?: number
          normalized_status?: string
          payment_id?: string | null
          provider?: string
          provider_anticipation_id?: string | null
          provider_payload?: Json
          provider_payment_id?: string | null
          provider_status?: string | null
          requested_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anticipated_amount?: number
          anticipation_date?: string | null
          anticipation_days?: number | null
          created_at?: string
          credited_at?: string | null
          denial_observation?: string | null
          documents?: Json
          documents_required?: boolean
          due_date?: string | null
          fee_amount?: number
          financial_account_id?: string | null
          gross_amount?: number
          id?: string
          installment_id?: string | null
          net_amount?: number
          normalized_status?: string
          payment_id?: string | null
          provider?: string
          provider_anticipation_id?: string | null
          provider_payload?: Json
          provider_payment_id?: string | null
          provider_status?: string | null
          requested_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "neurofinance_anticipations_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_anticipations_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_anticipations_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_anticipations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "nb_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_anticipations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "nb_payments_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_anticipations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_chargebacks_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_anticipations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_charges_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_anticipations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_eligible_anticipation_payments_v"
            referencedColumns: ["id"]
          },
        ]
      }
      neurofinance_baas_operations: {
        Row: {
          amount: number | null
          created_at: string
          description: string | null
          financial_account_id: string | null
          id: string
          operation_type: string
          payload: Json
          provider: string
          provider_operation_id: string | null
          provider_response: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description?: string | null
          financial_account_id?: string | null
          id?: string
          operation_type: string
          payload?: Json
          provider?: string
          provider_operation_id?: string | null
          provider_response?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string | null
          financial_account_id?: string | null
          id?: string
          operation_type?: string
          payload?: Json
          provider?: string
          provider_operation_id?: string | null
          provider_response?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "neurofinance_baas_operations_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_baas_operations_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_baas_operations_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
        ]
      }
      neurofinance_bill_payments: {
        Row: {
          amount: number
          authorized_at: string | null
          available_balance_at_review: number | null
          balance_source: string | null
          bank_code: string | null
          bank_name: string | null
          barcode: string | null
          beneficiary_document: string | null
          beneficiary_name: string | null
          can_be_cancelled: boolean | null
          consultation_expires_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          error_code: string | null
          error_message: string | null
          external_reference: string
          fee_amount: number
          financial_account_id: string | null
          id: string
          identification_field: string | null
          paid_at: string | null
          payment_date: string | null
          payment_mode: string | null
          provider: string
          provider_bill_id: string | null
          provider_payload: Json
          provider_status: string | null
          receipt_url: string | null
          scheduled_date: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          authorized_at?: string | null
          available_balance_at_review?: number | null
          balance_source?: string | null
          bank_code?: string | null
          bank_name?: string | null
          barcode?: string | null
          beneficiary_document?: string | null
          beneficiary_name?: string | null
          can_be_cancelled?: boolean | null
          consultation_expires_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          error_code?: string | null
          error_message?: string | null
          external_reference?: string
          fee_amount?: number
          financial_account_id?: string | null
          id?: string
          identification_field?: string | null
          paid_at?: string | null
          payment_date?: string | null
          payment_mode?: string | null
          provider?: string
          provider_bill_id?: string | null
          provider_payload?: Json
          provider_status?: string | null
          receipt_url?: string | null
          scheduled_date?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          authorized_at?: string | null
          available_balance_at_review?: number | null
          balance_source?: string | null
          bank_code?: string | null
          bank_name?: string | null
          barcode?: string | null
          beneficiary_document?: string | null
          beneficiary_name?: string | null
          can_be_cancelled?: boolean | null
          consultation_expires_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          error_code?: string | null
          error_message?: string | null
          external_reference?: string
          fee_amount?: number
          financial_account_id?: string | null
          id?: string
          identification_field?: string | null
          paid_at?: string | null
          payment_date?: string | null
          payment_mode?: string | null
          provider?: string
          provider_bill_id?: string | null
          provider_payload?: Json
          provider_status?: string | null
          receipt_url?: string | null
          scheduled_date?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "neurofinance_bill_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_bill_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_bill_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
        ]
      }
      neurofinance_contract_acceptances: {
        Row: {
          acceptance_type: string
          accepted_at: string
          actor_user_id: string | null
          content_hash: string
          content_reference: string
          content_version: string
          created_at: string
          financial_account_id: string | null
          flow_origin: string
          id: string
          ip_collection_basis: string | null
          metadata: Json
          provider: string
          user_id: string
        }
        Insert: {
          acceptance_type: string
          accepted_at?: string
          actor_user_id?: string | null
          content_hash: string
          content_reference: string
          content_version: string
          created_at?: string
          financial_account_id?: string | null
          flow_origin: string
          id?: string
          ip_collection_basis?: string | null
          metadata?: Json
          provider?: string
          user_id: string
        }
        Update: {
          acceptance_type?: string
          accepted_at?: string
          actor_user_id?: string | null
          content_hash?: string
          content_reference?: string
          content_version?: string
          created_at?: string
          financial_account_id?: string | null
          flow_origin?: string
          id?: string
          ip_collection_basis?: string | null
          metadata?: Json
          provider?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "neurofinance_contract_acceptances_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_contract_acceptances_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_contract_acceptances_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
        ]
      }
      neurofinance_outgoing_requests: {
        Row: {
          amount: number
          authorized_at: string | null
          available_balance_at_review: number | null
          completed_at: string | null
          consultation_expires_at: string | null
          created_at: string
          destination_payload: Json
          destination_summary: string | null
          error_code: string | null
          error_message: string | null
          external_reference: string
          fee_amount: number
          financial_account_id: string | null
          id: string
          kind: string
          payout_id: string | null
          provider: string
          provider_operation_id: string | null
          provider_payload: Json
          provider_status: string | null
          receipt_url: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          authorized_at?: string | null
          available_balance_at_review?: number | null
          completed_at?: string | null
          consultation_expires_at?: string | null
          created_at?: string
          destination_payload?: Json
          destination_summary?: string | null
          error_code?: string | null
          error_message?: string | null
          external_reference?: string
          fee_amount?: number
          financial_account_id?: string | null
          id?: string
          kind: string
          payout_id?: string | null
          provider?: string
          provider_operation_id?: string | null
          provider_payload?: Json
          provider_status?: string | null
          receipt_url?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          authorized_at?: string | null
          available_balance_at_review?: number | null
          completed_at?: string | null
          consultation_expires_at?: string | null
          created_at?: string
          destination_payload?: Json
          destination_summary?: string | null
          error_code?: string | null
          error_message?: string | null
          external_reference?: string
          fee_amount?: number
          financial_account_id?: string | null
          id?: string
          kind?: string
          payout_id?: string | null
          provider?: string
          provider_operation_id?: string | null
          provider_payload?: Json
          provider_status?: string | null
          receipt_url?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "neurofinance_outgoing_requests_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_outgoing_requests_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_outgoing_requests_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_outgoing_requests_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "nb_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_outgoing_requests_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "nb_payouts_safe_v"
            referencedColumns: ["id"]
          },
        ]
      }
      neurofinance_overview_snapshots: {
        Row: {
          available_balance: number
          calculated_available_balance: number
          created_at: string
          currency: string
          fees_total: number
          financial_account_id: string
          gross_received: number
          is_stale: boolean
          last_reconciled_at: string | null
          last_sync_error: string | null
          metadata: Json
          pending_receivables: number
          provider_as_of: string | null
          reconciliation_difference: number
          source: string
          total_outflow: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          calculated_available_balance?: number
          created_at?: string
          currency?: string
          fees_total?: number
          financial_account_id: string
          gross_received?: number
          is_stale?: boolean
          last_reconciled_at?: string | null
          last_sync_error?: string | null
          metadata?: Json
          pending_receivables?: number
          provider_as_of?: string | null
          reconciliation_difference?: number
          source?: string
          total_outflow?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          calculated_available_balance?: number
          created_at?: string
          currency?: string
          fees_total?: number
          financial_account_id?: string
          gross_received?: number
          is_stale?: boolean
          last_reconciled_at?: string | null
          last_sync_error?: string | null
          metadata?: Json
          pending_receivables?: number
          provider_as_of?: string | null
          reconciliation_difference?: number
          source?: string
          total_outflow?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "neurofinance_overview_snapshots_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: true
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_overview_snapshots_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: true
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_overview_snapshots_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: true
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
        ]
      }
      neurofinance_tariff_rules: {
        Row: {
          active: boolean
          category: string
          channel: string
          code: string
          created_at: string
          description: string | null
          display_name: string
          display_order: number
          effective_from: string
          effective_to: string | null
          fixed_fee_cents: number | null
          free_monthly_quota: number | null
          id: string
          installment_max: number | null
          installment_min: number | null
          metadata: Json
          operation: string
          payment_method: string | null
          percent_rate: number | null
          price_label: string | null
          settlement_business_days: boolean
          settlement_delay_days: number | null
          settlement_label: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          channel?: string
          code: string
          created_at?: string
          description?: string | null
          display_name: string
          display_order?: number
          effective_from?: string
          effective_to?: string | null
          fixed_fee_cents?: number | null
          free_monthly_quota?: number | null
          id?: string
          installment_max?: number | null
          installment_min?: number | null
          metadata?: Json
          operation: string
          payment_method?: string | null
          percent_rate?: number | null
          price_label?: string | null
          settlement_business_days?: boolean
          settlement_delay_days?: number | null
          settlement_label?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          channel?: string
          code?: string
          created_at?: string
          description?: string | null
          display_name?: string
          display_order?: number
          effective_from?: string
          effective_to?: string | null
          fixed_fee_cents?: number | null
          free_monthly_quota?: number | null
          id?: string
          installment_max?: number | null
          installment_min?: number | null
          metadata?: Json
          operation?: string
          payment_method?: string | null
          percent_rate?: number | null
          price_label?: string | null
          settlement_business_days?: boolean
          settlement_delay_days?: number | null
          settlement_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      normative_documents: {
        Row: {
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          title: string
        }
        Insert: {
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          title: string
        }
        Update: {
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          title?: string
        }
        Relationships: []
      }
      note_modules: {
        Row: {
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_push_deliveries: {
        Row: {
          attempted_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          notification_id: string
          provider_message_id: string | null
          sent_at: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempted_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          notification_id: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempted_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          notification_id?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_push_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_push_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          category: string
          created_at: string | null
          data: Json | null
          dismissed_at: string | null
          email_attempts: number
          email_last_error: string | null
          email_requested_at: string | null
          email_sent_at: string | null
          email_status: string
          event_id: string | null
          id: string
          message: string
          organization_id: string | null
          payload: Json
          priority: string | null
          push_attempts: number
          push_last_error: string | null
          push_requested_at: string | null
          push_sent_at: string | null
          push_status: string
          read: boolean | null
          read_at: string | null
          severity: string
          subaccount_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          category?: string
          created_at?: string | null
          data?: Json | null
          dismissed_at?: string | null
          email_attempts?: number
          email_last_error?: string | null
          email_requested_at?: string | null
          email_sent_at?: string | null
          email_status?: string
          event_id?: string | null
          id?: string
          message: string
          organization_id?: string | null
          payload?: Json
          priority?: string | null
          push_attempts?: number
          push_last_error?: string | null
          push_requested_at?: string | null
          push_sent_at?: string | null
          push_status?: string
          read?: boolean | null
          read_at?: string | null
          severity?: string
          subaccount_id?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          category?: string
          created_at?: string | null
          data?: Json | null
          dismissed_at?: string | null
          email_attempts?: number
          email_last_error?: string | null
          email_requested_at?: string | null
          email_sent_at?: string | null
          email_status?: string
          event_id?: string | null
          id?: string
          message?: string
          organization_id?: string | null
          payload?: Json
          priority?: string | null
          push_attempts?: number
          push_last_error?: string | null
          push_requested_at?: string | null
          push_sent_at?: string | null
          push_status?: string
          read?: boolean | null
          read_at?: string | null
          severity?: string
          subaccount_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notion_imports: {
        Row: {
          id: string
          imported_at: string
          last_edited_time: string | null
          note_id: string | null
          notion_page_id: string
          source_url: string | null
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          id?: string
          imported_at?: string
          last_edited_time?: string | null
          note_id?: string | null
          notion_page_id: string
          source_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          id?: string
          imported_at?: string
          last_edited_time?: string | null
          note_id?: string | null
          notion_page_id?: string
          source_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notion_imports_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "personal_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      package_financial_adjustment_outbox: {
        Row: {
          appointment_id: string | null
          attempt_count: number
          available_at: string
          created_at: string
          depends_on_idempotency_key: string | null
          financial_entry_id: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          next_attempt_at: string | null
          operation_id: string
          patient_id: string
          payload: Json
          payment_id: string | null
          professional_id: string
          source_package_id: string
          status: string
          target_package_id: string | null
          task_type: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          attempt_count?: number
          available_at?: string
          created_at?: string
          depends_on_idempotency_key?: string | null
          financial_entry_id?: string | null
          id?: string
          idempotency_key: string
          last_error?: string | null
          next_attempt_at?: string | null
          operation_id: string
          patient_id: string
          payload?: Json
          payment_id?: string | null
          professional_id: string
          source_package_id: string
          status?: string
          target_package_id?: string | null
          task_type: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          attempt_count?: number
          available_at?: string
          created_at?: string
          depends_on_idempotency_key?: string | null
          financial_entry_id?: string | null
          id?: string
          idempotency_key?: string
          last_error?: string | null
          next_attempt_at?: string | null
          operation_id?: string
          patient_id?: string
          payload?: Json
          payment_id?: string | null
          professional_id?: string
          source_package_id?: string
          status?: string
          target_package_id?: string | null
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_financial_adjustment_outbox_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_financial_adjustment_outbox_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_financial_adjustment_outbox_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "package_replacement_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_financial_adjustment_outbox_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_financial_adjustment_outbox_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "nb_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_financial_adjustment_outbox_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "nb_payments_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_financial_adjustment_outbox_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_chargebacks_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_financial_adjustment_outbox_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_charges_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_financial_adjustment_outbox_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_eligible_anticipation_payments_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_financial_adjustment_outbox_source_package_id_fkey"
            columns: ["source_package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_financial_adjustment_outbox_target_package_id_fkey"
            columns: ["target_package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_replacement_operations: {
        Row: {
          action_origin: string
          actor_user_id: string | null
          affected_appointments: number
          anchor_appointment_id: string | null
          completed_at: string | null
          created_at: string
          financial_strategy: string
          financial_summary: Json
          id: string
          idempotency_key: string
          operation_type: string
          patient_id: string
          preview_snapshot: Json
          professional_id: string
          reason: string
          scope: string
          series_id: string | null
          source_package_id: string
          status: string
          target_package_id: string | null
          updated_at: string
        }
        Insert: {
          action_origin?: string
          actor_user_id?: string | null
          affected_appointments?: number
          anchor_appointment_id?: string | null
          completed_at?: string | null
          created_at?: string
          financial_strategy: string
          financial_summary?: Json
          id?: string
          idempotency_key: string
          operation_type: string
          patient_id: string
          preview_snapshot?: Json
          professional_id: string
          reason: string
          scope: string
          series_id?: string | null
          source_package_id: string
          status?: string
          target_package_id?: string | null
          updated_at?: string
        }
        Update: {
          action_origin?: string
          actor_user_id?: string | null
          affected_appointments?: number
          anchor_appointment_id?: string | null
          completed_at?: string | null
          created_at?: string
          financial_strategy?: string
          financial_summary?: Json
          id?: string
          idempotency_key?: string
          operation_type?: string
          patient_id?: string
          preview_snapshot?: Json
          professional_id?: string
          reason?: string
          scope?: string
          series_id?: string | null
          source_package_id?: string
          status?: string
          target_package_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_replacement_operations_anchor_appointment_id_fkey"
            columns: ["anchor_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_replacement_operations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_replacement_operations_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "appointment_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_replacement_operations_source_package_id_fkey"
            columns: ["source_package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_replacement_operations_target_package_id_fkey"
            columns: ["target_package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_anamneses: {
        Row: {
          access_token: string | null
          content: Json
          created_at: string | null
          id: string
          patient_id: string
          token_expires_at: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          content?: Json
          created_at?: string | null
          id?: string
          patient_id: string
          token_expires_at?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          content?: Json
          created_at?: string | null
          id?: string
          patient_id?: string
          token_expires_at?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_anamneses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size_bytes: number | null
          id: string
          patient_id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size_bytes?: number | null
          id?: string
          patient_id: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          patient_id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_attachments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_financial_settings: {
        Row: {
          billing_day: number | null
          created_at: string
          id: string
          insurance_agreement_id: string | null
          insurance_card_expires_at: string | null
          insurance_card_number: string | null
          monthly_value_cents: number | null
          patient_id: string
          plan_type: string
          professional_name: string | null
          session_value_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_day?: number | null
          created_at?: string
          id?: string
          insurance_agreement_id?: string | null
          insurance_card_expires_at?: string | null
          insurance_card_number?: string | null
          monthly_value_cents?: number | null
          patient_id: string
          plan_type?: string
          professional_name?: string | null
          session_value_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_day?: number | null
          created_at?: string
          id?: string
          insurance_agreement_id?: string | null
          insurance_card_expires_at?: string | null
          insurance_card_number?: string | null
          monthly_value_cents?: number | null
          patient_id?: string
          plan_type?: string
          professional_name?: string | null
          session_value_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_financial_settings_insurance_agreement_id_fkey"
            columns: ["insurance_agreement_id"]
            isOneToOne: false
            referencedRelation: "patient_insurance_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_financial_settings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_goals: {
        Row: {
          created_at: string | null
          description: string
          due_date: string | null
          id: string
          is_completed: boolean | null
          patient_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          patient_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          patient_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_goals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_insurance_agreements: {
        Row: {
          active: boolean
          created_at: string
          expected_receipt_days: number
          id: string
          name: string
          repass_percentage: number | null
          repass_type: string
          repass_value_cents: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          expected_receipt_days?: number
          id?: string
          name: string
          repass_percentage?: number | null
          repass_type?: string
          repass_value_cents?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          expected_receipt_days?: number
          id?: string
          name?: string
          repass_percentage?: number | null
          repass_type?: string
          repass_value_cents?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_lookup_options: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind: string
          label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_mood_logs: {
        Row: {
          created_at: string | null
          created_by_user_id: string | null
          id: string
          mood_score: number
          notes: string | null
          patient_id: string | null
          source: string
          tags: string[] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id?: string | null
          id?: string
          mood_score: number
          notes?: string | null
          patient_id?: string | null
          source?: string
          tags?: string[] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string | null
          id?: string
          mood_score?: number
          notes?: string | null
          patient_id?: string | null
          source?: string
          tags?: string[] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_mood_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_package_session_usages: {
        Row: {
          action: string
          appointment_id: string | null
          binding_id: string | null
          created_at: string
          id: string
          idempotency_key: string
          metadata: Json
          package_id: string
          patient_id: string
          professional_id: string
          reason: string | null
          reverses_usage_id: string | null
          series_id: string | null
          source: string
        }
        Insert: {
          action?: string
          appointment_id?: string | null
          binding_id?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          metadata?: Json
          package_id: string
          patient_id: string
          professional_id: string
          reason?: string | null
          reverses_usage_id?: string | null
          series_id?: string | null
          source?: string
        }
        Update: {
          action?: string
          appointment_id?: string | null
          binding_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          package_id?: string
          patient_id?: string
          professional_id?: string
          reason?: string | null
          reverses_usage_id?: string | null
          series_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_package_session_usages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_package_session_usages_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: false
            referencedRelation: "appointment_package_bindings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_package_session_usages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_package_session_usages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_package_session_usages_reverses_usage_id_fkey"
            columns: ["reverses_usage_id"]
            isOneToOne: false
            referencedRelation: "patient_package_session_usages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_package_session_usages_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "appointment_series"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_packages: {
        Row: {
          active: string | null
          balance: number | null
          billing_mode: string
          billing_status: string
          created_at: string | null
          default_payment_method: string | null
          description: string
          due_day: number | null
          end_date: string | null
          ended_at: string | null
          ended_by: string | null
          ended_origin: string | null
          ended_reason: string | null
          id: string
          package_status: string
          patient_id: string
          price: number | null
          replaced_by_package_id: string | null
          sessions_reserved: number
          sessions_used: number
          start_date: string | null
          total_sessions: number
          user_id: string
        }
        Insert: {
          active?: string | null
          balance?: number | null
          billing_mode?: string
          billing_status?: string
          created_at?: string | null
          default_payment_method?: string | null
          description: string
          due_day?: number | null
          end_date?: string | null
          ended_at?: string | null
          ended_by?: string | null
          ended_origin?: string | null
          ended_reason?: string | null
          id?: string
          package_status?: string
          patient_id: string
          price?: number | null
          replaced_by_package_id?: string | null
          sessions_reserved?: number
          sessions_used?: number
          start_date?: string | null
          total_sessions: number
          user_id: string
        }
        Update: {
          active?: string | null
          balance?: number | null
          billing_mode?: string
          billing_status?: string
          created_at?: string | null
          default_payment_method?: string | null
          description?: string
          due_day?: number | null
          end_date?: string | null
          ended_at?: string | null
          ended_by?: string | null
          ended_origin?: string | null
          ended_reason?: string | null
          id?: string
          package_status?: string
          patient_id?: string
          price?: number | null
          replaced_by_package_id?: string | null
          sessions_reserved?: number
          sessions_used?: number
          start_date?: string | null
          total_sessions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_packages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_packages_replaced_by_package_id_fkey"
            columns: ["replaced_by_package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_portal_audit_logs: {
        Row: {
          action: string
          actor_type: string
          actor_user_id: string | null
          created_at: string
          id: string
          invite_id: string | null
          link_id: string | null
          metadata: Json
          patient_id: string | null
          patient_user_id: string | null
          psychologist_user_id: string | null
        }
        Insert: {
          action: string
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          invite_id?: string | null
          link_id?: string | null
          metadata?: Json
          patient_id?: string | null
          patient_user_id?: string | null
          psychologist_user_id?: string | null
        }
        Update: {
          action?: string
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          invite_id?: string | null
          link_id?: string | null
          metadata?: Json
          patient_id?: string | null
          patient_user_id?: string | null
          psychologist_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_portal_audit_logs_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "patient_portal_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_portal_audit_logs_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "patient_portal_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_portal_audit_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_portal_invites: {
        Row: {
          activated_at: string | null
          activation_attempts: number
          activation_code_hash: string
          blocked_at: string | null
          created_at: string
          expires_at: string
          id: string
          last_sent_at: string | null
          max_attempts: number
          metadata: Json
          patient_email: string
          patient_id: string
          psychologist_user_id: string
          revoked_at: string | null
          sent_count: number
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activation_attempts?: number
          activation_code_hash: string
          blocked_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          last_sent_at?: string | null
          max_attempts?: number
          metadata?: Json
          patient_email: string
          patient_id: string
          psychologist_user_id: string
          revoked_at?: string | null
          sent_count?: number
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activation_attempts?: number
          activation_code_hash?: string
          blocked_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_sent_at?: string | null
          max_attempts?: number
          metadata?: Json
          patient_email?: string
          patient_id?: string
          psychologist_user_id?: string
          revoked_at?: string | null
          sent_count?: number
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_portal_invites_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_portal_links: {
        Row: {
          activated_at: string
          created_at: string
          id: string
          invite_id: string | null
          last_accessed_at: string | null
          metadata: Json
          patient_id: string
          patient_user_id: string
          psychologist_user_id: string
          revoked_at: string | null
          status: string
          suspended_at: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string
          created_at?: string
          id?: string
          invite_id?: string | null
          last_accessed_at?: string | null
          metadata?: Json
          patient_id: string
          patient_user_id: string
          psychologist_user_id: string
          revoked_at?: string | null
          status?: string
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string
          created_at?: string
          id?: string
          invite_id?: string | null
          last_accessed_at?: string | null
          metadata?: Json
          patient_id?: string
          patient_user_id?: string
          psychologist_user_id?: string
          revoked_at?: string | null
          status?: string
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_portal_links_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "patient_portal_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_portal_links_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_responsibles: {
        Row: {
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          mobile_phone: string | null
          name: string | null
          patient_id: string
          phone_country_code: string
          rg: string | null
          updated_at: string
          use_for_billing_documents: boolean
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          mobile_phone?: string | null
          name?: string | null
          patient_id: string
          phone_country_code?: string
          rg?: string | null
          updated_at?: string
          use_for_billing_documents?: boolean
          user_id: string
        }
        Update: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          mobile_phone?: string | null
          name?: string | null
          patient_id?: string
          phone_country_code?: string
          rg?: string | null
          updated_at?: string
          use_for_billing_documents?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_responsibles_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          asaas_customer_id: string | null
          birth_date: string | null
          city: string | null
          complement: string | null
          country: string
          cpf: string | null
          created_at: string | null
          diagnosis: string | null
          education_level: string | null
          email: string | null
          emergency_contact: string | null
          gender_identity: string | null
          group_type: string
          has_social_name: boolean
          id: string
          landline_phone: string | null
          last_risk_assessment: string | null
          last_session: string | null
          medications: Json | null
          mobile_phone: string | null
          name: string
          naturality: string | null
          neighborhood: string | null
          next_session: string | null
          notes: string | null
          patient_id: string | null
          payer_cpf: string | null
          payer_name: string | null
          payer_type: string | null
          phone: string | null
          phone_country_code: string
          postal_code: string | null
          profession: string | null
          quick_registration: boolean
          race: string | null
          referred_by_option_id: string | null
          relative_name: string | null
          relative_phone: string | null
          relative_relationship: string | null
          rg: string | null
          risk_score: number | null
          risk_score_scale: number
          social_name: string | null
          state: string | null
          status: string | null
          street: string | null
          street_number: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          asaas_customer_id?: string | null
          birth_date?: string | null
          city?: string | null
          complement?: string | null
          country?: string
          cpf?: string | null
          created_at?: string | null
          diagnosis?: string | null
          education_level?: string | null
          email?: string | null
          emergency_contact?: string | null
          gender_identity?: string | null
          group_type?: string
          has_social_name?: boolean
          id?: string
          landline_phone?: string | null
          last_risk_assessment?: string | null
          last_session?: string | null
          medications?: Json | null
          mobile_phone?: string | null
          name: string
          naturality?: string | null
          neighborhood?: string | null
          next_session?: string | null
          notes?: string | null
          patient_id?: string | null
          payer_cpf?: string | null
          payer_name?: string | null
          payer_type?: string | null
          phone?: string | null
          phone_country_code?: string
          postal_code?: string | null
          profession?: string | null
          quick_registration?: boolean
          race?: string | null
          referred_by_option_id?: string | null
          relative_name?: string | null
          relative_phone?: string | null
          relative_relationship?: string | null
          rg?: string | null
          risk_score?: number | null
          risk_score_scale?: number
          social_name?: string | null
          state?: string | null
          status?: string | null
          street?: string | null
          street_number?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          asaas_customer_id?: string | null
          birth_date?: string | null
          city?: string | null
          complement?: string | null
          country?: string
          cpf?: string | null
          created_at?: string | null
          diagnosis?: string | null
          education_level?: string | null
          email?: string | null
          emergency_contact?: string | null
          gender_identity?: string | null
          group_type?: string
          has_social_name?: boolean
          id?: string
          landline_phone?: string | null
          last_risk_assessment?: string | null
          last_session?: string | null
          medications?: Json | null
          mobile_phone?: string | null
          name?: string
          naturality?: string | null
          neighborhood?: string | null
          next_session?: string | null
          notes?: string | null
          patient_id?: string | null
          payer_cpf?: string | null
          payer_name?: string | null
          payer_type?: string | null
          phone?: string | null
          phone_country_code?: string
          postal_code?: string | null
          profession?: string | null
          quick_registration?: boolean
          race?: string | null
          referred_by_option_id?: string | null
          relative_name?: string | null
          relative_phone?: string | null
          relative_relationship?: string | null
          rg?: string | null
          risk_score?: number | null
          risk_score_scale?: number
          social_name?: string | null
          state?: string | null
          status?: string | null
          street?: string | null
          street_number?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_referred_by_option_id_fkey"
            columns: ["referred_by_option_id"]
            isOneToOne: false
            referencedRelation: "patient_lookup_options"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_notes: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          module_id: string | null
          patient_id: string | null
          reference_date: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          module_id?: string | null
          patient_id?: string | null
          reference_date?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          module_id?: string | null
          patient_id?: string | null
          reference_date?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_notes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "note_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_availability_exceptions: {
        Row: {
          availability_version_id: string | null
          created_at: string
          ends_at: string
          exception_kind: string
          id: string
          professional_id: string
          reason: string | null
          source: string
          starts_at: string
        }
        Insert: {
          availability_version_id?: string | null
          created_at?: string
          ends_at: string
          exception_kind: string
          id?: string
          professional_id: string
          reason?: string | null
          source?: string
          starts_at: string
        }
        Update: {
          availability_version_id?: string | null
          created_at?: string
          ends_at?: string
          exception_kind?: string
          id?: string
          professional_id?: string
          reason?: string | null
          source?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_exceptio_availability_version_id_fkey"
            columns: ["availability_version_id"]
            isOneToOne: false
            referencedRelation: "professional_availability_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_availability_impacts: {
        Row: {
          appointment_id: string | null
          availability_version_id: string
          created_at: string
          details: Json
          id: string
          impact_kind: string
          professional_id: string
          resolution: string
          resolved_at: string | null
          waitlist_entry_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          availability_version_id: string
          created_at?: string
          details?: Json
          id?: string
          impact_kind: string
          professional_id: string
          resolution?: string
          resolved_at?: string | null
          waitlist_entry_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          availability_version_id?: string
          created_at?: string
          details?: Json
          id?: string
          impact_kind?: string
          professional_id?: string
          resolution?: string
          resolved_at?: string | null
          waitlist_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_impacts_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_availability_impacts_availability_version_id_fkey"
            columns: ["availability_version_id"]
            isOneToOne: false
            referencedRelation: "professional_availability_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_availability_impacts_waitlist_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "professional_waitlist_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_availability_versions: {
        Row: {
          change_strategy: string
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          legacy_snapshot: Json
          professional_id: string
          reason: string | null
          status: string
          timezone: string
          version_number: number
        }
        Insert: {
          change_strategy?: string
          created_at?: string
          created_by?: string | null
          effective_from: string
          id?: string
          legacy_snapshot?: Json
          professional_id: string
          reason?: string | null
          status?: string
          timezone?: string
          version_number: number
        }
        Update: {
          change_strategy?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          legacy_snapshot?: Json
          professional_id?: string
          reason?: string | null
          status?: string
          timezone?: string
          version_number?: number
        }
        Relationships: []
      }
      professional_availability_windows: {
        Row: {
          availability_version_id: string
          created_at: string
          end_time: string
          id: string
          professional_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          availability_version_id: string
          created_at?: string
          end_time: string
          id?: string
          professional_id: string
          start_time: string
          weekday: number
        }
        Update: {
          availability_version_id?: string
          created_at?: string
          end_time?: string
          id?: string
          professional_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_windows_availability_version_id_fkey"
            columns: ["availability_version_id"]
            isOneToOne: false
            referencedRelation: "professional_availability_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_event_categories: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          is_default: boolean
          name: string
          professional_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          is_default?: boolean
          name: string
          professional_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          is_default?: boolean
          name?: string
          professional_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      professional_waitlist_entries: {
        Row: {
          availability_version_id: string | null
          created_at: string
          created_by: string | null
          id: string
          last_offered_at: string | null
          location: string | null
          minimum_duration_minutes: number
          modality: string | null
          offer_automatically: boolean
          offer_count: number
          patient_id: string
          preferred_duration_minutes: number
          priority: number
          professional_id: string
          rules_snapshot: Json
          status: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          availability_version_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_offered_at?: string | null
          location?: string | null
          minimum_duration_minutes?: number
          modality?: string | null
          offer_automatically?: boolean
          offer_count?: number
          patient_id: string
          preferred_duration_minutes?: number
          priority?: number
          professional_id: string
          rules_snapshot?: Json
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          availability_version_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_offered_at?: string | null
          location?: string | null
          minimum_duration_minutes?: number
          modality?: string | null
          offer_automatically?: boolean
          offer_count?: number
          patient_id?: string
          preferred_duration_minutes?: number
          priority?: number
          professional_id?: string
          rules_snapshot?: Json
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_waitlist_entries_availability_version_id_fkey"
            columns: ["availability_version_id"]
            isOneToOne: false
            referencedRelation: "professional_availability_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_waitlist_entries_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_waitlist_events: {
        Row: {
          actor_type: string
          created_at: string
          event_type: string
          id: string
          offer_id: string | null
          professional_id: string
          safe_metadata: Json
          waitlist_entry_id: string
        }
        Insert: {
          actor_type: string
          created_at?: string
          event_type: string
          id?: string
          offer_id?: string | null
          professional_id: string
          safe_metadata?: Json
          waitlist_entry_id: string
        }
        Update: {
          actor_type?: string
          created_at?: string
          event_type?: string
          id?: string
          offer_id?: string | null
          professional_id?: string
          safe_metadata?: Json
          waitlist_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_waitlist_events_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "professional_waitlist_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_waitlist_events_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "professional_waitlist_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_waitlist_offer_outbox: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          lease_expires_at: string | null
          lease_token: string | null
          next_attempt_at: string
          offer_id: string
          payload: Json
          professional_id: string
          provider: string | null
          provider_message_id: string | null
          status: string
          template_key: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          id?: string
          idempotency_key: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          offer_id: string
          payload?: Json
          professional_id: string
          provider?: string | null
          provider_message_id?: string | null
          status?: string
          template_key?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          id?: string
          idempotency_key?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          offer_id?: string
          payload?: Json
          professional_id?: string
          provider?: string | null
          provider_message_id?: string | null
          status?: string
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_waitlist_offer_outbox_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "professional_waitlist_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_waitlist_offers: {
        Row: {
          accepted_appointment_id: string | null
          appointment_snapshot: Json
          created_at: string
          expires_at: string
          hold_id: string
          id: string
          offered_end_time: string
          offered_start_time: string
          patient_id: string
          professional_id: string
          responded_at: string | null
          status: string
          token_hash: string
          waitlist_entry_id: string
        }
        Insert: {
          accepted_appointment_id?: string | null
          appointment_snapshot?: Json
          created_at?: string
          expires_at: string
          hold_id: string
          id?: string
          offered_end_time: string
          offered_start_time: string
          patient_id: string
          professional_id: string
          responded_at?: string | null
          status?: string
          token_hash: string
          waitlist_entry_id: string
        }
        Update: {
          accepted_appointment_id?: string | null
          appointment_snapshot?: Json
          created_at?: string
          expires_at?: string
          hold_id?: string
          id?: string
          offered_end_time?: string
          offered_start_time?: string
          patient_id?: string
          professional_id?: string
          responded_at?: string | null
          status?: string
          token_hash?: string
          waitlist_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_waitlist_offers_accepted_appointment_id_fkey"
            columns: ["accepted_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_waitlist_offers_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "appointment_slot_holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_waitlist_offers_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_waitlist_offers_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "professional_waitlist_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_waitlist_windows: {
        Row: {
          created_at: string
          end_time: string
          id: string
          professional_id: string
          specific_date: string | null
          start_time: string
          waitlist_entry_id: string
          weekday: number | null
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          professional_id: string
          specific_date?: string | null
          start_time: string
          waitlist_entry_id: string
          weekday?: number | null
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          professional_id?: string
          specific_date?: string | null
          start_time?: string
          waitlist_entry_id?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_waitlist_windows_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "professional_waitlist_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          address_city: string | null
          address_country: string | null
          address_line1: string | null
          address_postal_code: string | null
          address_state: string | null
          ai_preferences: Json | null
          avatar_url: string | null
          bio: string | null
          calendar_sync_enabled: boolean
          clinic_name: string | null
          crp: string | null
          first_name: string | null
          full_name: string | null
          gender_identity: string | null
          gmail_send_enabled: boolean
          id: string
          initial_preferences: Json
          last_name: string | null
          name: string | null
          neurofinance_intro_choice: string | null
          phone: string | null
          professional_address: Json
          professional_context: string | null
          recovery_email: string | null
          remoteJid: string | null
          response_id: string | null
          setup_completed: string | null
          signup_completed_at: string | null
          sms_notifications_enabled: boolean | null
          specialty: string | null
          subscription_plan: string | null
          timestamp: string | null
          tokens: number | null
          two_factor_enabled: boolean | null
          two_factor_method: string | null
          updated_at: string | null
          working_hours: Json | null
        }
        Insert: {
          address?: string | null
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          ai_preferences?: Json | null
          avatar_url?: string | null
          bio?: string | null
          calendar_sync_enabled?: boolean
          clinic_name?: string | null
          crp?: string | null
          first_name?: string | null
          full_name?: string | null
          gender_identity?: string | null
          gmail_send_enabled?: boolean
          id: string
          initial_preferences?: Json
          last_name?: string | null
          name?: string | null
          neurofinance_intro_choice?: string | null
          phone?: string | null
          professional_address?: Json
          professional_context?: string | null
          recovery_email?: string | null
          remoteJid?: string | null
          response_id?: string | null
          setup_completed?: string | null
          signup_completed_at?: string | null
          sms_notifications_enabled?: boolean | null
          specialty?: string | null
          subscription_plan?: string | null
          timestamp?: string | null
          tokens?: number | null
          two_factor_enabled?: boolean | null
          two_factor_method?: string | null
          updated_at?: string | null
          working_hours?: Json | null
        }
        Update: {
          address?: string | null
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          ai_preferences?: Json | null
          avatar_url?: string | null
          bio?: string | null
          calendar_sync_enabled?: boolean
          clinic_name?: string | null
          crp?: string | null
          first_name?: string | null
          full_name?: string | null
          gender_identity?: string | null
          gmail_send_enabled?: boolean
          id?: string
          initial_preferences?: Json
          last_name?: string | null
          name?: string | null
          neurofinance_intro_choice?: string | null
          phone?: string | null
          professional_address?: Json
          professional_context?: string | null
          recovery_email?: string | null
          remoteJid?: string | null
          response_id?: string | null
          setup_completed?: string | null
          signup_completed_at?: string | null
          sms_notifications_enabled?: boolean | null
          specialty?: string | null
          subscription_plan?: string | null
          timestamp?: string | null
          tokens?: number | null
          two_factor_enabled?: boolean | null
          two_factor_method?: string | null
          updated_at?: string | null
          working_hours?: Json | null
        }
        Relationships: []
      }
      psychologist_patient_preferences: {
        Row: {
          created_at: string
          default_country: string
          default_financial_plan: string
          default_group_type: string
          default_quick_registration: boolean
          default_session_value_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_country?: string
          default_financial_plan?: string
          default_group_type?: string
          default_quick_registration?: boolean
          default_session_value_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_country?: string
          default_financial_plan?: string
          default_group_type?: string
          default_quick_registration?: boolean
          default_session_value_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          browser: string | null
          created_at: string
          device_id: string | null
          device_name: string | null
          enabled: boolean
          fcm_token: string
          id: string
          last_seen_at: string
          permission: string
          platform: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_id?: string | null
          device_name?: string | null
          enabled?: boolean
          fcm_token: string
          id?: string
          last_seen_at?: string
          permission?: string
          platform?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_id?: string | null
          device_name?: string | null
          enabled?: boolean
          fcm_token?: string
          id?: string
          last_seen_at?: string
          permission?: string
          platform?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_appointments: {
        Row: {
          created_at: string | null
          duration_minutes: number
          end_date: string
          id: string
          location: string | null
          notes: string | null
          patient_id: string
          recurrence_type: string
          recurrence_value: string | null
          start_date: string
          start_time: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_minutes: number
          end_date: string
          id?: string
          location?: string | null
          notes?: string | null
          patient_id: string
          recurrence_type: string
          recurrence_value?: string | null
          start_date: string
          start_time: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number
          end_date?: string
          id?: string
          location?: string | null
          notes?: string | null
          patient_id?: string
          recurrence_type?: string
          recurrence_value?: string | null
          start_date?: string
          start_time?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expenses: {
        Row: {
          active: boolean | null
          amount: number
          category: string | null
          created_at: string | null
          day_of_month: number
          description: string
          id: string
          last_generated_date: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          amount: number
          category?: string | null
          created_at?: string | null
          day_of_month: number
          description: string
          id?: string
          last_generated_date?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          amount?: number
          category?: string | null
          created_at?: string | null
          day_of_month?: number
          description?: string
          id?: string
          last_generated_date?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      recurring_financial_entries: {
        Row: {
          amount: number
          category_id: string | null
          clinic_id: string | null
          created_at: string
          end_date: string | null
          frequency: string
          id: string
          idempotency_key: string | null
          metadata: Json
          next_generation_date: string | null
          professional_id: string
          start_date: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          clinic_id?: string | null
          created_at?: string
          end_date?: string | null
          frequency: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          next_generation_date?: string | null
          professional_id: string
          start_date: string
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          clinic_id?: string | null
          created_at?: string
          end_date?: string | null
          frequency?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          next_generation_date?: string | null
          professional_id?: string
          start_date?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_financial_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoices: {
        Row: {
          active: boolean | null
          amount: number
          created_at: string | null
          day_of_month: number
          description: string
          id: string
          last_generated_date: string | null
          patient_id: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          amount: number
          created_at?: string | null
          day_of_month: number
          description: string
          id?: string
          last_generated_date?: string | null
          patient_id?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          amount?: number
          created_at?: string | null
          day_of_month?: number
          description?: string
          id?: string
          last_generated_date?: string | null
          patient_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          category: string | null
          created_at: string | null
          due_date: string
          id: string
          is_completed: boolean | null
          note_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          due_date: string
          id?: string
          is_completed?: boolean | null
          note_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          due_date?: string
          id?: string
          is_completed?: boolean | null
          note_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "personal_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      session_chat_messages: {
        Row: {
          appointment_id: string
          content: string
          created_at: string
          id: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          appointment_id: string
          content: string
          created_at?: string
          id?: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Update: {
          appointment_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_chat_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          ai_summary: Json | null
          ai_summary_edit_count: number
          ai_summary_edited: boolean
          ai_summary_edited_at: string | null
          ai_summary_edited_by: string | null
          appointment_id: string | null
          auto_confirmed_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          id: string
          locked_at: string | null
          notes: string
          original_ai_summary: Json | null
          original_transcription: string | null
          patient_id: string
          review_due_at: string | null
          review_status: string
          source_transcript_id: string | null
          transcription: string | null
          user_id: string
        }
        Insert: {
          ai_summary?: Json | null
          ai_summary_edit_count?: number
          ai_summary_edited?: boolean
          ai_summary_edited_at?: string | null
          ai_summary_edited_by?: string | null
          appointment_id?: string | null
          auto_confirmed_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          id?: string
          locked_at?: string | null
          notes: string
          original_ai_summary?: Json | null
          original_transcription?: string | null
          patient_id: string
          review_due_at?: string | null
          review_status?: string
          source_transcript_id?: string | null
          transcription?: string | null
          user_id: string
        }
        Update: {
          ai_summary?: Json | null
          ai_summary_edit_count?: number
          ai_summary_edited?: boolean
          ai_summary_edited_at?: string | null
          ai_summary_edited_by?: string | null
          appointment_id?: string | null
          auto_confirmed_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          id?: string
          locked_at?: string | null
          notes?: string
          original_ai_summary?: Json | null
          original_transcription?: string | null
          patient_id?: string
          review_due_at?: string | null
          review_status?: string
          source_transcript_id?: string | null
          transcription?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_source_transcript_id_fkey"
            columns: ["source_transcript_id"]
            isOneToOne: false
            referencedRelation: "session_transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      session_transcript_segments: {
        Row: {
          captured_at: string
          client_segment_id: string
          confidence: number | null
          created_at: string
          ended_at_ms: number | null
          id: string
          is_final: boolean
          metadata: Json
          sequence: number
          source: string
          speaker_id: string | null
          speaker_label: string | null
          started_at_ms: number | null
          text: string
          transcript_id: string
          user_id: string
        }
        Insert: {
          captured_at?: string
          client_segment_id: string
          confidence?: number | null
          created_at?: string
          ended_at_ms?: number | null
          id?: string
          is_final?: boolean
          metadata?: Json
          sequence: number
          source: string
          speaker_id?: string | null
          speaker_label?: string | null
          started_at_ms?: number | null
          text: string
          transcript_id: string
          user_id: string
        }
        Update: {
          captured_at?: string
          client_segment_id?: string
          confidence?: number | null
          created_at?: string
          ended_at_ms?: number | null
          id?: string
          is_final?: boolean
          metadata?: Json
          sequence?: number
          source?: string
          speaker_id?: string | null
          speaker_label?: string | null
          started_at_ms?: number | null
          text?: string
          transcript_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_transcript_segments_transcript_user_fk"
            columns: ["transcript_id", "user_id"]
            isOneToOne: false
            referencedRelation: "session_transcripts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      session_transcripts: {
        Row: {
          appointment_id: string | null
          consent_method: string | null
          consent_notes: string | null
          consent_recorded_at: string | null
          consent_status: string
          created_at: string
          deleted_at: string | null
          ended_at: string | null
          error_code: string | null
          error_message: string | null
          finalized_at: string | null
          id: string
          language: string
          last_synced_at: string | null
          metadata: Json
          modality: string
          patient_id: string | null
          paused_at: string | null
          provider: string
          retention_policy: string
          retention_until: string | null
          reviewed_at: string | null
          started_at: string | null
          status: string
          summary_note_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          consent_method?: string | null
          consent_notes?: string | null
          consent_recorded_at?: string | null
          consent_status?: string
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          error_code?: string | null
          error_message?: string | null
          finalized_at?: string | null
          id?: string
          language?: string
          last_synced_at?: string | null
          metadata?: Json
          modality: string
          patient_id?: string | null
          paused_at?: string | null
          provider?: string
          retention_policy?: string
          retention_until?: string | null
          reviewed_at?: string | null
          started_at?: string | null
          status?: string
          summary_note_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          consent_method?: string | null
          consent_notes?: string | null
          consent_recorded_at?: string | null
          consent_status?: string
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          error_code?: string | null
          error_message?: string | null
          finalized_at?: string | null
          id?: string
          language?: string
          last_synced_at?: string | null
          metadata?: Json
          modality?: string
          patient_id?: string | null
          paused_at?: string | null
          provider?: string
          retention_policy?: string
          retention_until?: string | null
          reviewed_at?: string | null
          started_at?: string | null
          status?: string
          summary_note_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_transcripts_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_transcripts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_transcripts_summary_note_id_fkey"
            columns: ["summary_note_id"]
            isOneToOne: false
            referencedRelation: "session_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_email_verifications: {
        Row: {
          attempts: number
          blocked_until: string | null
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string
          gender_identity: string | null
          id: string
          max_attempts: number
          metadata: Json
          phone: string | null
          professional_context: string | null
          recovery_email: string | null
          resend_count: number
          signup_token_hash: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          full_name: string
          gender_identity?: string | null
          id?: string
          max_attempts?: number
          metadata?: Json
          phone?: string | null
          professional_context?: string | null
          recovery_email?: string | null
          resend_count?: number
          signup_token_hash?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          gender_identity?: string | null
          id?: string
          max_attempts?: number
          metadata?: Json
          phone?: string | null
          professional_context?: string | null
          recovery_email?: string | null
          resend_count?: number
          signup_token_hash?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      subscription_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          checkout_session_id: string | null
          created_at: string
          event_id: string | null
          from_access_state: string | null
          from_status: string | null
          id: string
          metadata: Json
          reason: string | null
          subscription_record_id: string | null
          to_access_state: string | null
          to_status: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          checkout_session_id?: string | null
          created_at?: string
          event_id?: string | null
          from_access_state?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          subscription_record_id?: string | null
          to_access_state?: string | null
          to_status?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          checkout_session_id?: string | null
          created_at?: string
          event_id?: string | null
          from_access_state?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          subscription_record_id?: string | null
          to_access_state?: string | null
          to_status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_audit_logs_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "subscription_checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_audit_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "subscription_events"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_checkout_sessions: {
        Row: {
          amount_cents: number
          billing_type: string | null
          canceled_at: string | null
          checkout_url: string | null
          created_at: string
          currency: string
          error_message: string | null
          expires_at: string | null
          external_reference: string
          id: string
          metadata: Json
          paid_at: string | null
          plan: string
          plan_code: string
          provider: string
          provider_checkout_id: string | null
          provider_payment_id: string | null
          provider_subscription_id: string | null
          status: string
          subscription_record_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          billing_type?: string | null
          canceled_at?: string | null
          checkout_url?: string | null
          created_at?: string
          currency?: string
          error_message?: string | null
          expires_at?: string | null
          external_reference: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          plan?: string
          plan_code?: string
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          subscription_record_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          billing_type?: string | null
          canceled_at?: string | null
          checkout_url?: string | null
          created_at?: string
          currency?: string
          error_message?: string | null
          expires_at?: string | null
          external_reference?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          plan?: string
          plan_code?: string
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          subscription_record_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_checkout_sessions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "subscription_plan_catalog"
            referencedColumns: ["plan_code"]
          },
        ]
      }
      subscription_events: {
        Row: {
          checkout_session_id: string | null
          created_at: string
          effect: string
          event_created_at: string | null
          event_type: string
          external_reference: string | null
          id: string
          object_id: string | null
          object_type: string | null
          payload: Json
          processed_at: string | null
          processing_status: string
          provider: string
          provider_checkout_id: string | null
          provider_event_id: string
          provider_payment_id: string | null
          provider_subscription_id: string | null
          subscription_record_id: string | null
          user_id: string | null
        }
        Insert: {
          checkout_session_id?: string | null
          created_at?: string
          effect?: string
          event_created_at?: string | null
          event_type: string
          external_reference?: string | null
          id?: string
          object_id?: string | null
          object_type?: string | null
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          provider?: string
          provider_checkout_id?: string | null
          provider_event_id: string
          provider_payment_id?: string | null
          provider_subscription_id?: string | null
          subscription_record_id?: string | null
          user_id?: string | null
        }
        Update: {
          checkout_session_id?: string | null
          created_at?: string
          effect?: string
          event_created_at?: string | null
          event_type?: string
          external_reference?: string | null
          id?: string
          object_id?: string | null
          object_type?: string | null
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          provider?: string
          provider_checkout_id?: string | null
          provider_event_id?: string
          provider_payment_id?: string | null
          provider_subscription_id?: string | null
          subscription_record_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "subscription_checkout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plan_catalog: {
        Row: {
          billing_cycle: string
          created_at: string
          currency: string
          description: string | null
          features: Json
          internal_flags: Json
          is_active: boolean
          limits: Json
          plan_code: string
          price_cents: number | null
          public_name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          internal_flags?: Json
          is_active?: boolean
          limits?: Json
          plan_code: string
          price_cents?: number | null
          public_name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          internal_flags?: Json
          is_active?: boolean
          limits?: Json
          plan_code?: string
          price_cents?: number | null
          public_name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscription_usage_counters: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          limit_value: Json | null
          metadata: Json
          period_end: string
          period_start: string
          plan_code: string
          updated_at: string
          used_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          limit_value?: Json | null
          metadata?: Json
          period_end: string
          period_start: string
          plan_code: string
          updated_at?: string
          used_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          limit_value?: Json | null
          metadata?: Json
          period_end?: string
          period_start?: string
          plan_code?: string
          updated_at?: string
          used_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_usage_counters_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "subscription_plan_catalog"
            referencedColumns: ["plan_code"]
          },
        ]
      }
      support_requests: {
        Row: {
          category: string
          created_at: string
          email: string
          id: string
          is_customer: boolean
          message: string
          metadata: Json
          name: string
          phone: string | null
          source: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          email: string
          id?: string
          is_customer?: boolean
          message: string
          metadata?: Json
          name: string
          phone?: string | null
          source?: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          email?: string
          id?: string
          is_customer?: boolean
          message?: string
          metadata?: Json
          name?: string
          phone?: string | null
          source?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      synapse_action_logs: {
        Row: {
          action_type: string
          channel: string
          confirmation_required: boolean
          created_at: string
          duration_ms: number
          error_message: string | null
          id: string
          payload: Json
          risk_level: string | null
          session_id: string | null
          status: string
          tool_name: string | null
          user_id: string
          voice_session_id: string | null
        }
        Insert: {
          action_type: string
          channel: string
          confirmation_required?: boolean
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          id?: string
          payload?: Json
          risk_level?: string | null
          session_id?: string | null
          status: string
          tool_name?: string | null
          user_id?: string
          voice_session_id?: string | null
        }
        Update: {
          action_type?: string
          channel?: string
          confirmation_required?: boolean
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          id?: string
          payload?: Json
          risk_level?: string | null
          session_id?: string | null
          status?: string
          tool_name?: string | null
          user_id?: string
          voice_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "synapse_action_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synapse_action_logs_voice_session_id_fkey"
            columns: ["voice_session_id"]
            isOneToOne: false
            referencedRelation: "synapse_voice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      synapse_activations: {
        Row: {
          activation_type: string
          content_summary: string | null
          cost_estimate: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          processing_time_ms: number | null
          status: string | null
          tokens_total: number | null
          trigger_source: string
          user_id: string | null
        }
        Insert: {
          activation_type: string
          content_summary?: string | null
          cost_estimate?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          processing_time_ms?: number | null
          status?: string | null
          tokens_total?: number | null
          trigger_source: string
          user_id?: string | null
        }
        Update: {
          activation_type?: string
          content_summary?: string | null
          cost_estimate?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          processing_time_ms?: number | null
          status?: string | null
          tokens_total?: number | null
          trigger_source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      synapse_channel_bindings: {
        Row: {
          channel: string
          created_at: string
          external_user_id: string
          id: string
          instance_name: string | null
          last_seen_at: string
          professional_id: string
          push_name: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          external_user_id: string
          id: string
          instance_name?: string | null
          last_seen_at?: string
          professional_id: string
          push_name?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          external_user_id?: string
          id?: string
          instance_name?: string | null
          last_seen_at?: string
          professional_id?: string
          push_name?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      synapse_logs: {
        Row: {
          action: string
          created_at: string | null
          error_message: string | null
          id: string
          input_data: Json | null
          latency_ms: number | null
          log_type: string
          metadata: Json | null
          output_data: Json | null
          session_id: string | null
          status: string | null
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          latency_ms?: number | null
          log_type: string
          metadata?: Json | null
          output_data?: Json | null
          session_id?: string | null
          status?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          latency_ms?: number | null
          log_type?: string
          metadata?: Json | null
          output_data?: Json | null
          session_id?: string | null
          status?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      synapse_notes_agent_run_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          run_id: string
          sequence: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          run_id: string
          sequence: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          run_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "synapse_notes_agent_run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "synapse_notes_agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      synapse_notes_agent_runs: {
        Row: {
          chat_session_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          intent: string | null
          note_id: string | null
          patient_id: string | null
          product: string
          progress: number
          pulse_entry_id: string | null
          result: Json
          status: string
          steps: Json
          target_flow_id: string | null
          trace: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_session_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          intent?: string | null
          note_id?: string | null
          patient_id?: string | null
          product: string
          progress?: number
          pulse_entry_id?: string | null
          result?: Json
          status?: string
          steps?: Json
          target_flow_id?: string | null
          trace?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_session_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          intent?: string | null
          note_id?: string | null
          patient_id?: string | null
          product?: string
          progress?: number
          pulse_entry_id?: string | null
          result?: Json
          status?: string
          steps?: Json
          target_flow_id?: string | null
          trace?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "synapse_notes_agent_runs_chat_session_id_fkey"
            columns: ["chat_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synapse_notes_agent_runs_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "personal_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synapse_notes_agent_runs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synapse_notes_agent_runs_pulse_entry_id_fkey"
            columns: ["pulse_entry_id"]
            isOneToOne: false
            referencedRelation: "neuro_pulse_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synapse_notes_agent_runs_target_flow_id_fkey"
            columns: ["target_flow_id"]
            isOneToOne: false
            referencedRelation: "neuro_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      synapse_usage_quota: {
        Row: {
          created_at: string
          last_request_at: string | null
          limit_count: number
          locked_at: string | null
          metadata: Json
          unlocks_at: string | null
          updated_at: string
          used_count: number
          user_id: string
          window_started_at: string
        }
        Insert: {
          created_at?: string
          last_request_at?: string | null
          limit_count?: number
          locked_at?: string | null
          metadata?: Json
          unlocks_at?: string | null
          updated_at?: string
          used_count?: number
          user_id: string
          window_started_at?: string
        }
        Update: {
          created_at?: string
          last_request_at?: string | null
          limit_count?: number
          locked_at?: string | null
          metadata?: Json
          unlocks_at?: string | null
          updated_at?: string
          used_count?: number
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      synapse_voice_sessions: {
        Row: {
          close_code: number | null
          close_reason: string | null
          conversation_id: string
          created_at: string
          ended_at: string | null
          id: string
          last_event_at: string
          latency_ms: Json
          listen_model: string | null
          metadata: Json
          provider: string
          psychologist_id: string
          started_at: string
          status: string
          stt_provider: string
          think_model: string | null
          tts_provider: string
          updated_at: string
          user_id: string
          voice_id: string | null
        }
        Insert: {
          close_code?: number | null
          close_reason?: string | null
          conversation_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          last_event_at?: string
          latency_ms?: Json
          listen_model?: string | null
          metadata?: Json
          provider?: string
          psychologist_id: string
          started_at?: string
          status?: string
          stt_provider?: string
          think_model?: string | null
          tts_provider?: string
          updated_at?: string
          user_id: string
          voice_id?: string | null
        }
        Update: {
          close_code?: number | null
          close_reason?: string | null
          conversation_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          last_event_at?: string
          latency_ms?: Json
          listen_model?: string | null
          metadata?: Json
          provider?: string
          psychologist_id?: string
          started_at?: string
          status?: string
          stt_provider?: string
          think_model?: string | null
          tts_provider?: string
          updated_at?: string
          user_id?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "synapse_voice_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      synapse_voice_turns: {
        Row: {
          confirmation_required: boolean
          conversation_id: string
          created_at: string
          ended_at: string | null
          id: string
          is_final: boolean
          metadata: Json
          origin: string
          response_text: string | null
          role: string
          started_at: string
          tool_call_id: string | null
          tool_name: string | null
          transcript: string | null
          user_id: string
          voice_session_id: string
        }
        Insert: {
          confirmation_required?: boolean
          conversation_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_final?: boolean
          metadata?: Json
          origin?: string
          response_text?: string | null
          role: string
          started_at?: string
          tool_call_id?: string | null
          tool_name?: string | null
          transcript?: string | null
          user_id: string
          voice_session_id: string
        }
        Update: {
          confirmation_required?: boolean
          conversation_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_final?: boolean
          metadata?: Json
          origin?: string
          response_text?: string | null
          role?: string
          started_at?: string
          tool_call_id?: string | null
          tool_name?: string | null
          transcript?: string | null
          user_id?: string
          voice_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "synapse_voice_turns_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synapse_voice_turns_voice_session_id_fkey"
            columns: ["voice_session_id"]
            isOneToOne: false
            referencedRelation: "synapse_voice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      synapse_whatsapp_instances: {
        Row: {
          created_at: string
          enabled: boolean
          environment: string
          id: string
          instance_key: string | null
          instance_name: string
          label: string | null
          last_connection_state: string | null
          metadata: Json
          owner_remote_jid: string | null
          professional_id: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          environment?: string
          id?: string
          instance_key?: string | null
          instance_name: string
          label?: string | null
          last_connection_state?: string | null
          metadata?: Json
          owner_remote_jid?: string | null
          professional_id: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          environment?: string
          id?: string
          instance_key?: string | null
          instance_name?: string
          label?: string | null
          last_connection_state?: string | null
          metadata?: Json
          owner_remote_jid?: string | null
          professional_id?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      system_email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string
          enabled: boolean
          preheader: string | null
          sender_profile: string
          subject: string
          template_key: string
          updated_at: string
          version: number
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string
          enabled?: boolean
          preheader?: string | null
          sender_profile?: string
          subject: string
          template_key: string
          updated_at?: string
          version?: number
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string
          enabled?: boolean
          preheader?: string | null
          sender_profile?: string
          subject?: string
          template_key?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      teleconsultation_sessions: {
        Row: {
          appointment_id: string | null
          created_at: string | null
          end_time: string | null
          id: string
          meet_link: string | null
          provider: string
          start_time: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string | null
          end_time?: string | null
          id?: string
          meet_link?: string | null
          provider: string
          start_time?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string | null
          end_time?: string | null
          id?: string
          meet_link?: string | null
          provider?: string
          start_time?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teleconsultation_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          is_shared: boolean | null
          name: string
          psychologist_id: string
          tags: string[] | null
          type: string
          updated_at: string | null
          usage_count: number | null
          variables: Json | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_shared?: boolean | null
          name: string
          psychologist_id: string
          tags?: string[] | null
          type: string
          updated_at?: string | null
          usage_count?: number | null
          variables?: Json | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_shared?: boolean | null
          name?: string
          psychologist_id?: string
          tags?: string[] | null
          type?: string
          updated_at?: string | null
          usage_count?: number | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_psychologist_id_fkey"
            columns: ["psychologist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_templates: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string | null
          description: string
          icon: string | null
          id: string
          name: string
          type: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          category?: string | null
          created_at?: string | null
          description: string
          icon?: string | null
          id?: string
          name: string
          type: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          category?: string | null
          created_at?: string | null
          description?: string
          icon?: string | null
          id?: string
          name?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_financial_settings: {
        Row: {
          id: string
          pin_hash: string | null
          pin_last_verified_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          pin_hash?: string | null
          pin_last_verified_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          pin_hash?: string | null
          pin_last_verified_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_fiscal_settings: {
        Row: {
          asaas_fiscal_info: Json
          asaas_last_sync_at: string | null
          asaas_last_sync_error: string | null
          asaas_municipal_options: Json
          asaas_municipal_service_id: string | null
          asaas_municipal_service_name: string | null
          auto_issue: boolean | null
          certificate_file_id: string | null
          certificate_password: string | null
          cnae: string | null
          cnpj: string | null
          cofins_aliquot: number
          company_name: string | null
          created_at: string | null
          csll_aliquot: number
          cultural_projects_promoter: boolean
          fiscal_email: string | null
          fiscal_provider: string
          id: string
          inss_aliquot: number
          ir_aliquot: number
          iss_aliquot: number | null
          municipal_code: string | null
          municipal_inscription: string | null
          nbs_code: string | null
          pis_aliquot: number
          retain_iss: boolean
          rps_number: number | null
          rps_serie: string | null
          service_code: string | null
          service_list_item: string | null
          simples_nacional: boolean
          special_tax_regime: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          asaas_fiscal_info?: Json
          asaas_last_sync_at?: string | null
          asaas_last_sync_error?: string | null
          asaas_municipal_options?: Json
          asaas_municipal_service_id?: string | null
          asaas_municipal_service_name?: string | null
          auto_issue?: boolean | null
          certificate_file_id?: string | null
          certificate_password?: string | null
          cnae?: string | null
          cnpj?: string | null
          cofins_aliquot?: number
          company_name?: string | null
          created_at?: string | null
          csll_aliquot?: number
          cultural_projects_promoter?: boolean
          fiscal_email?: string | null
          fiscal_provider?: string
          id?: string
          inss_aliquot?: number
          ir_aliquot?: number
          iss_aliquot?: number | null
          municipal_code?: string | null
          municipal_inscription?: string | null
          nbs_code?: string | null
          pis_aliquot?: number
          retain_iss?: boolean
          rps_number?: number | null
          rps_serie?: string | null
          service_code?: string | null
          service_list_item?: string | null
          simples_nacional?: boolean
          special_tax_regime?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          asaas_fiscal_info?: Json
          asaas_last_sync_at?: string | null
          asaas_last_sync_error?: string | null
          asaas_municipal_options?: Json
          asaas_municipal_service_id?: string | null
          asaas_municipal_service_name?: string | null
          auto_issue?: boolean | null
          certificate_file_id?: string | null
          certificate_password?: string | null
          cnae?: string | null
          cnpj?: string | null
          cofins_aliquot?: number
          company_name?: string | null
          created_at?: string | null
          csll_aliquot?: number
          cultural_projects_promoter?: boolean
          fiscal_email?: string | null
          fiscal_provider?: string
          id?: string
          inss_aliquot?: number
          ir_aliquot?: number
          iss_aliquot?: number | null
          municipal_code?: string | null
          municipal_inscription?: string | null
          nbs_code?: string | null
          pis_aliquot?: number
          retain_iss?: boolean
          rps_number?: number | null
          rps_serie?: string | null
          service_code?: string | null
          service_list_item?: string | null
          simples_nacional?: boolean
          special_tax_regime?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_google_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          refresh_token: string
          scope: string | null
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          refresh_token: string
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_microsoft_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string | null
          refresh_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at?: string | null
          refresh_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string | null
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_notification_settings: {
        Row: {
          email_appointment_reminders: boolean | null
          email_enabled: boolean | null
          email_payment_confirmations: boolean | null
          email_security_alerts: boolean | null
          id: string
          in_app_enabled: boolean | null
          in_app_new_patients: boolean | null
          in_app_overdue_invoices: boolean | null
          in_app_system_updates: boolean | null
          push_enabled: boolean
          sms_appointments: boolean
          sms_enabled: boolean
          sms_security_alerts: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          email_appointment_reminders?: boolean | null
          email_enabled?: boolean | null
          email_payment_confirmations?: boolean | null
          email_security_alerts?: boolean | null
          id?: string
          in_app_enabled?: boolean | null
          in_app_new_patients?: boolean | null
          in_app_overdue_invoices?: boolean | null
          in_app_system_updates?: boolean | null
          push_enabled?: boolean
          sms_appointments?: boolean
          sms_enabled?: boolean
          sms_security_alerts?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          email_appointment_reminders?: boolean | null
          email_enabled?: boolean | null
          email_payment_confirmations?: boolean | null
          email_security_alerts?: boolean | null
          id?: string
          in_app_enabled?: boolean | null
          in_app_new_patients?: boolean | null
          in_app_overdue_invoices?: boolean | null
          in_app_system_updates?: boolean | null
          push_enabled?: boolean
          sms_appointments?: boolean
          sms_enabled?: boolean
          sms_security_alerts?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_notion_tokens: {
        Row: {
          access_token: string
          bot_id: string | null
          created_at: string | null
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          access_token: string
          bot_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          access_token?: string
          bot_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          density: string
          language: string
          reduced_motion: boolean
          theme: string
          timezone: string
          updated_at: string
          user_id: string
          week_starts_on: number
        }
        Insert: {
          created_at?: string
          density?: string
          language?: string
          reduced_motion?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          user_id: string
          week_starts_on?: number
        }
        Update: {
          created_at?: string
          density?: string
          language?: string
          reduced_motion?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          week_starts_on?: number
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          access_state: string
          asaas_checkout_id: string | null
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          blocked_at: string | null
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          external_reference: string | null
          grace_period_ends_at: string | null
          id: string
          last_payment_event_at: string | null
          last_payment_id: string | null
          last_payment_status: string | null
          metadata: Json
          plan: string
          plan_code: string
          price_id: string | null
          status: string
          status_version: number
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_state?: string
          asaas_checkout_id?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          blocked_at?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          external_reference?: string | null
          grace_period_ends_at?: string | null
          id?: string
          last_payment_event_at?: string | null
          last_payment_id?: string | null
          last_payment_status?: string | null
          metadata?: Json
          plan?: string
          plan_code?: string
          price_id?: string | null
          status?: string
          status_version?: number
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_state?: string
          asaas_checkout_id?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          blocked_at?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          external_reference?: string | null
          grace_period_ends_at?: string | null
          id?: string
          last_payment_event_at?: string | null
          last_payment_id?: string | null
          last_payment_status?: string | null
          metadata?: Json
          plan?: string
          plan_code?: string
          price_id?: string | null
          status?: string
          status_version?: number
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "subscription_plan_catalog"
            referencedColumns: ["plan_code"]
          },
        ]
      }
      user_todoist_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          crp: string | null
          email: string
          id: string
          name: string
          source: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          crp?: string | null
          email: string
          id?: string
          name: string
          source?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          crp?: string | null
          email?: string
          id?: string
          name?: string
          source?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          attempt_number: number | null
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          success: boolean | null
          webhook_id: string
        }
        Insert: {
          attempt_number?: number | null
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
          webhook_id: string
        }
        Update: {
          attempt_number?: number | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          active: boolean | null
          created_at: string | null
          events: string[]
          headers: Json | null
          id: string
          name: string
          retry_attempts: number | null
          secret: string | null
          timeout_seconds: number | null
          updated_at: string | null
          url: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          events: string[]
          headers?: Json | null
          id?: string
          name: string
          retry_attempts?: number | null
          secret?: string | null
          timeout_seconds?: number | null
          updated_at?: string | null
          url: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          events?: string[]
          headers?: Json | null
          id?: string
          name?: string
          retry_attempts?: number | null
          secret?: string | null
          timeout_seconds?: number | null
          updated_at?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          canonical_remote_jid: string | null
          contact_about: string | null
          contact_last_seen_at: string | null
          contact_status: string | null
          contact_type: string
          conversation_kind: string
          created_at: string
          deleted_at: string | null
          id: string
          instance_name: string
          is_group: boolean
          labels: Json
          last_message_at: string
          last_message_preview: string | null
          patient_name: string | null
          patient_phone: string | null
          profile_picture_url: string | null
          raw_payload: Json
          remote_jid: string
          remote_jid_aliases: Json
          synapse_session_id: string | null
          unread_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          canonical_remote_jid?: string | null
          contact_about?: string | null
          contact_last_seen_at?: string | null
          contact_status?: string | null
          contact_type?: string
          conversation_kind?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          instance_name?: string
          is_group?: boolean
          labels?: Json
          last_message_at?: string
          last_message_preview?: string | null
          patient_name?: string | null
          patient_phone?: string | null
          profile_picture_url?: string | null
          raw_payload?: Json
          remote_jid: string
          remote_jid_aliases?: Json
          synapse_session_id?: string | null
          unread_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          canonical_remote_jid?: string | null
          contact_about?: string | null
          contact_last_seen_at?: string | null
          contact_status?: string | null
          contact_type?: string
          conversation_kind?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          instance_name?: string
          is_group?: boolean
          labels?: Json
          last_message_at?: string
          last_message_preview?: string | null
          patient_name?: string | null
          patient_phone?: string | null
          profile_picture_url?: string | null
          raw_payload?: Json
          remote_jid?: string
          remote_jid_aliases?: Json
          synapse_session_id?: string | null
          unread_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_synapse_session_id_fkey"
            columns: ["synapse_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          canonical_remote_jid: string | null
          content: string | null
          content_type: string
          conversation_id: string | null
          created_at: string
          direction: string
          id: string
          instance_name: string
          is_from_ai: boolean
          media_base64: string | null
          media_filename: string | null
          media_mimetype: string | null
          raw_payload: Json
          remote_jid: string
          sender_kind: string
          source_message_id: string | null
          status: string
          synapse_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canonical_remote_jid?: string | null
          content?: string | null
          content_type?: string
          conversation_id?: string | null
          created_at?: string
          direction: string
          id?: string
          instance_name?: string
          is_from_ai?: boolean
          media_base64?: string | null
          media_filename?: string | null
          media_mimetype?: string | null
          raw_payload?: Json
          remote_jid: string
          sender_kind?: string
          source_message_id?: string | null
          status?: string
          synapse_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          canonical_remote_jid?: string | null
          content?: string | null
          content_type?: string
          conversation_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          instance_name?: string
          is_from_ai?: boolean
          media_base64?: string | null
          media_filename?: string | null
          media_mimetype?: string | null
          raw_payload?: Json
          remote_jid?: string
          sender_kind?: string
          source_message_id?: string | null
          status?: string
          synapse_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_synapse_session_id_fkey"
            columns: ["synapse_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          connection_state: string | null
          created_at: string
          environment: string
          instance_name: string
          is_active: boolean
          last_error: string | null
          last_status_at: string | null
          last_sync_at: string | null
          metadata: Json
          psychologist_phone: string | null
          psychologist_remote_jid: string | null
          settings_applied_at: string | null
          updated_at: string
          user_id: string
          webhook_enabled: boolean | null
          webhook_events: string[]
          webhook_url: string | null
        }
        Insert: {
          connection_state?: string | null
          created_at?: string
          environment?: string
          instance_name?: string
          is_active?: boolean
          last_error?: string | null
          last_status_at?: string | null
          last_sync_at?: string | null
          metadata?: Json
          psychologist_phone?: string | null
          psychologist_remote_jid?: string | null
          settings_applied_at?: string | null
          updated_at?: string
          user_id: string
          webhook_enabled?: boolean | null
          webhook_events?: string[]
          webhook_url?: string | null
        }
        Update: {
          connection_state?: string | null
          created_at?: string
          environment?: string
          instance_name?: string
          is_active?: boolean
          last_error?: string | null
          last_status_at?: string | null
          last_sync_at?: string | null
          metadata?: Json
          psychologist_phone?: string | null
          psychologist_remote_jid?: string | null
          settings_applied_at?: string | null
          updated_at?: string
          user_id?: string
          webhook_enabled?: boolean | null
          webhook_events?: string[]
          webhook_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      current_subscription_entitlements: {
        Row: {
          access_state: string | null
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          billing_cycle: string | null
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          effective_access_state: string | null
          effective_status: string | null
          features: Json | null
          grace_period_ends_at: string | null
          has_current_access: boolean | null
          has_paid_access: boolean | null
          internal_flags: Json | null
          last_payment_event_at: string | null
          last_payment_id: string | null
          last_payment_status: string | null
          limits: Json | null
          plan: string | null
          plan_code: string | null
          price_cents: number | null
          public_name: string | null
          requires_upsell: boolean | null
          status: string | null
          subscription_record_id: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      financial_accounts_safe_v: {
        Row: {
          account_status: Json | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_postal_code: string | null
          address_state: string | null
          address_street: string | null
          asaas_account_id: string | null
          asaas_environment: string | null
          asaas_onboarding_url: string | null
          asaas_privacy_policy_reference: string | null
          asaas_terms_reference: string | null
          asaas_wallet_id: string | null
          bank_account_last4: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_code: string | null
          bank_holder_cpf_cnpj: string | null
          bank_holder_name: string | null
          bank_name: string | null
          birth_date: string | null
          business_description: string | null
          business_mcc: string | null
          business_url: string | null
          card_enabled: boolean | null
          charges_enabled: boolean | null
          company_type: string | null
          cpf_cnpj: string | null
          created_at: string | null
          default_currency: string | null
          details_submitted: boolean | null
          holder_name: string | null
          id: string | null
          income_value: number | null
          last_asaas_event_at: string | null
          last_asaas_event_type: string | null
          last_balance_sync_at: string | null
          last_sync_error: string | null
          mobile_phone: string | null
          neuronex_terms_version: string | null
          onboarding_completed_at: string | null
          onboarding_started_at: string | null
          payouts_enabled: boolean | null
          pep_status: string | null
          pix_enabled: boolean | null
          pix_key_consent_at: string | null
          platform_fee_fixed: number | null
          platform_fee_percent: number | null
          provider: string | null
          requirements: Json | null
          status: string | null
          tos_accepted_at: string | null
          ui_status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_status?: never
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          asaas_account_id?: string | null
          asaas_environment?: string | null
          asaas_onboarding_url?: string | null
          asaas_privacy_policy_reference?: string | null
          asaas_terms_reference?: string | null
          asaas_wallet_id?: string | null
          bank_account_last4?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          bank_holder_cpf_cnpj?: string | null
          bank_holder_name?: string | null
          bank_name?: string | null
          birth_date?: string | null
          business_description?: string | null
          business_mcc?: string | null
          business_url?: string | null
          card_enabled?: boolean | null
          charges_enabled?: boolean | null
          company_type?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          default_currency?: string | null
          details_submitted?: boolean | null
          holder_name?: string | null
          id?: string | null
          income_value?: number | null
          last_asaas_event_at?: string | null
          last_asaas_event_type?: string | null
          last_balance_sync_at?: string | null
          last_sync_error?: string | null
          mobile_phone?: string | null
          neuronex_terms_version?: string | null
          onboarding_completed_at?: string | null
          onboarding_started_at?: string | null
          payouts_enabled?: boolean | null
          pep_status?: string | null
          pix_enabled?: boolean | null
          pix_key_consent_at?: string | null
          platform_fee_fixed?: number | null
          platform_fee_percent?: number | null
          provider?: string | null
          requirements?: never
          status?: string | null
          tos_accepted_at?: string | null
          ui_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_status?: never
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          asaas_account_id?: string | null
          asaas_environment?: string | null
          asaas_onboarding_url?: string | null
          asaas_privacy_policy_reference?: string | null
          asaas_terms_reference?: string | null
          asaas_wallet_id?: string | null
          bank_account_last4?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          bank_holder_cpf_cnpj?: string | null
          bank_holder_name?: string | null
          bank_name?: string | null
          birth_date?: string | null
          business_description?: string | null
          business_mcc?: string | null
          business_url?: string | null
          card_enabled?: boolean | null
          charges_enabled?: boolean | null
          company_type?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          default_currency?: string | null
          details_submitted?: boolean | null
          holder_name?: string | null
          id?: string | null
          income_value?: number | null
          last_asaas_event_at?: string | null
          last_asaas_event_type?: string | null
          last_balance_sync_at?: string | null
          last_sync_error?: string | null
          mobile_phone?: string | null
          neuronex_terms_version?: string | null
          onboarding_completed_at?: string | null
          onboarding_started_at?: string | null
          payouts_enabled?: boolean | null
          pep_status?: string | null
          pix_enabled?: boolean | null
          pix_key_consent_at?: string | null
          platform_fee_fixed?: number | null
          platform_fee_percent?: number | null
          provider?: string | null
          requirements?: never
          status?: string | null
          tos_accepted_at?: string | null
          ui_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      financial_integrity_audit_v: {
        Row: {
          check_name: string | null
          issue_count: number | null
          professional_id: string | null
        }
        Relationships: []
      }
      financial_monthly_summary_v: {
        Row: {
          clinic_id: string | null
          current_result: number | null
          expected_result: number | null
          expense_paid: number | null
          expense_total: number | null
          expense_unpaid: number | null
          income_paid: number | null
          income_total: number | null
          income_unpaid: number | null
          month: string | null
          professional_id: string | null
        }
        Relationships: []
      }
      nb_payments_safe_v: {
        Row: {
          actual_fee_amount: number | null
          anticipable: boolean | null
          anticipated: boolean | null
          appointment_id: string | null
          available_at: string | null
          bank_slip_url: string | null
          boleto_pdf: string | null
          boleto_url: string | null
          cancelable: boolean | null
          channel: string | null
          checkout_url: string | null
          confirmed_at: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          dispute_amount: number | null
          dispute_reason: string | null
          dispute_status: string | null
          estimated_credit_at: string | null
          estimated_fee_amount: number | null
          expires_at: string | null
          financial_account_id: string | null
          funds_status: string | null
          gross_amount: number | null
          id: string | null
          installments: number | null
          invoice_url: string | null
          net_amount: number | null
          nfse_authorized_at: string | null
          nfse_error_message: string | null
          nfse_number: string | null
          nfse_pdf_url: string | null
          nfse_provider: string | null
          nfse_reference: string | null
          nfse_status: string | null
          nfse_status_description: string | null
          nfse_synced_at: string | null
          nfse_verification_code: string | null
          nfse_xml_url: string | null
          normalized_status: string | null
          paid_at: string | null
          patient_id: string | null
          payment_method_type: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          platform_fee_amount: number | null
          provider: string | null
          provider_due_date: string | null
          receipt_url: string | null
          refund_amount: number | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          actual_fee_amount?: number | null
          anticipable?: boolean | null
          anticipated?: boolean | null
          appointment_id?: string | null
          available_at?: string | null
          bank_slip_url?: never
          boleto_pdf?: string | null
          boleto_url?: string | null
          cancelable?: never
          channel?: string | null
          checkout_url?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          dispute_amount?: number | null
          dispute_reason?: string | null
          dispute_status?: string | null
          estimated_credit_at?: string | null
          estimated_fee_amount?: number | null
          expires_at?: string | null
          financial_account_id?: string | null
          funds_status?: string | null
          gross_amount?: number | null
          id?: string | null
          installments?: number | null
          invoice_url?: never
          net_amount?: number | null
          nfse_authorized_at?: string | null
          nfse_error_message?: string | null
          nfse_number?: string | null
          nfse_pdf_url?: string | null
          nfse_provider?: string | null
          nfse_reference?: string | null
          nfse_status?: string | null
          nfse_status_description?: string | null
          nfse_synced_at?: string | null
          nfse_verification_code?: string | null
          nfse_xml_url?: string | null
          normalized_status?: string | null
          paid_at?: string | null
          patient_id?: string | null
          payment_method_type?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          platform_fee_amount?: number | null
          provider?: string | null
          provider_due_date?: string | null
          receipt_url?: never
          refund_amount?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          actual_fee_amount?: number | null
          anticipable?: boolean | null
          anticipated?: boolean | null
          appointment_id?: string | null
          available_at?: string | null
          bank_slip_url?: never
          boleto_pdf?: string | null
          boleto_url?: string | null
          cancelable?: never
          channel?: string | null
          checkout_url?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          dispute_amount?: number | null
          dispute_reason?: string | null
          dispute_status?: string | null
          estimated_credit_at?: string | null
          estimated_fee_amount?: number | null
          expires_at?: string | null
          financial_account_id?: string | null
          funds_status?: string | null
          gross_amount?: number | null
          id?: string | null
          installments?: number | null
          invoice_url?: never
          net_amount?: number | null
          nfse_authorized_at?: string | null
          nfse_error_message?: string | null
          nfse_number?: string | null
          nfse_pdf_url?: string | null
          nfse_provider?: string | null
          nfse_reference?: string | null
          nfse_status?: string | null
          nfse_status_description?: string | null
          nfse_synced_at?: string | null
          nfse_verification_code?: string | null
          nfse_xml_url?: string | null
          normalized_status?: string | null
          paid_at?: string | null
          patient_id?: string | null
          payment_method_type?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          platform_fee_amount?: number | null
          provider?: string | null
          provider_due_date?: string | null
          receipt_url?: never
          refund_amount?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
        ]
      }
      nb_payouts_safe_v: {
        Row: {
          amount: number | null
          completed_at: string | null
          created_at: string | null
          currency: string | null
          destination_summary: string | null
          destination_type: string | null
          error_code: string | null
          error_message: string | null
          fee_amount: number | null
          financial_account_id: string | null
          id: string | null
          operation_type: string | null
          processed_at: string | null
          provider: string | null
          receipt_url: string | null
          requested_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          destination_summary?: string | null
          destination_type?: string | null
          error_code?: never
          error_message?: never
          fee_amount?: number | null
          financial_account_id?: string | null
          id?: string | null
          operation_type?: string | null
          processed_at?: string | null
          provider?: string | null
          receipt_url?: never
          requested_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          destination_summary?: string | null
          destination_type?: string | null
          error_code?: never
          error_message?: never
          fee_amount?: number | null
          financial_account_id?: string | null
          id?: string | null
          operation_type?: string | null
          processed_at?: string | null
          provider?: string | null
          receipt_url?: never
          requested_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nb_payouts_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payouts_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payouts_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
        ]
      }
      neurofinance_account_state: {
        Row: {
          account_state: Json | null
          asaas_account_id: string | null
          asaas_environment: string | null
          asaas_wallet_id: string | null
          bank_account: string | null
          bank_account_digit: string | null
          bank_account_last4: string | null
          bank_agency: string | null
          bank_code: string | null
          bank_name: string | null
          charges_enabled: boolean | null
          details_submitted: boolean | null
          id: string | null
          last_asaas_event_at: string | null
          last_asaas_event_type: string | null
          last_balance_sync_at: string | null
          last_sync_error: string | null
          payouts_enabled: boolean | null
          provider: string | null
          requirements: Json | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_state?: never
          asaas_account_id?: string | null
          asaas_environment?: string | null
          asaas_wallet_id?: string | null
          bank_account?: string | null
          bank_account_digit?: string | null
          bank_account_last4?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          charges_enabled?: boolean | null
          details_submitted?: boolean | null
          id?: string | null
          last_asaas_event_at?: string | null
          last_asaas_event_type?: string | null
          last_balance_sync_at?: string | null
          last_sync_error?: string | null
          payouts_enabled?: boolean | null
          provider?: string | null
          requirements?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_state?: never
          asaas_account_id?: string | null
          asaas_environment?: string | null
          asaas_wallet_id?: string | null
          bank_account?: string | null
          bank_account_digit?: string | null
          bank_account_last4?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          charges_enabled?: boolean | null
          details_submitted?: boolean | null
          id?: string | null
          last_asaas_event_at?: string | null
          last_asaas_event_type?: string | null
          last_balance_sync_at?: string | null
          last_sync_error?: string | null
          payouts_enabled?: boolean | null
          provider?: string | null
          requirements?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      neurofinance_activity_v: {
        Row: {
          activity_type: string | null
          amount: number | null
          description: string | null
          metadata: Json | null
          occurred_at: string | null
          source_id: string | null
          status: string | null
          user_id: string | null
        }
        Relationships: []
      }
      neurofinance_chargebacks_v: {
        Row: {
          created_at: string | null
          description: string | null
          dispute_amount: number | null
          dispute_id: string | null
          dispute_reason: string | null
          dispute_status: string | null
          financial_account_id: string | null
          funds_status: string | null
          gross_amount: number | null
          id: string | null
          metadata: Json | null
          normalized_status: string | null
          paid_at: string | null
          payment_method_type: string | null
          provider_payment_id: string | null
          provider_status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          dispute_amount?: number | null
          dispute_id?: string | null
          dispute_reason?: string | null
          dispute_status?: string | null
          financial_account_id?: string | null
          funds_status?: string | null
          gross_amount?: number | null
          id?: string | null
          metadata?: Json | null
          normalized_status?: string | null
          paid_at?: string | null
          payment_method_type?: string | null
          provider_payment_id?: string | null
          provider_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          dispute_amount?: number | null
          dispute_id?: string | null
          dispute_reason?: string | null
          dispute_status?: string | null
          financial_account_id?: string | null
          funds_status?: string | null
          gross_amount?: number | null
          id?: string | null
          metadata?: Json | null
          normalized_status?: string | null
          paid_at?: string | null
          payment_method_type?: string | null
          provider_payment_id?: string | null
          provider_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
        ]
      }
      neurofinance_charges_v: {
        Row: {
          appointment_id: string | null
          checkout_url: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          expires_at: string | null
          financial_account_id: string | null
          gross_amount: number | null
          id: string | null
          metadata: Json | null
          net_amount: number | null
          paid_at: string | null
          patient_id: string | null
          patient_name: string | null
          payment_method_type: string | null
          platform_fee_amount: number | null
          provider: string | null
          provider_payment_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
        ]
      }
      neurofinance_eligible_anticipation_payments_v: {
        Row: {
          anticipable: boolean | null
          anticipated: boolean | null
          created_at: string | null
          description: string | null
          due_date: string | null
          estimated_credit_at: string | null
          financial_account_id: string | null
          funds_status: string | null
          gross_amount: number | null
          id: string | null
          installment_id: string | null
          metadata: Json | null
          net_amount: number | null
          normalized_status: string | null
          payment_method_type: string | null
          platform_fee_amount: number | null
          provider_payment_id: string | null
          provider_status: string | null
          user_id: string | null
        }
        Insert: {
          anticipable?: boolean | null
          anticipated?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_credit_at?: string | null
          financial_account_id?: string | null
          funds_status?: string | null
          gross_amount?: number | null
          id?: string | null
          installment_id?: string | null
          metadata?: Json | null
          net_amount?: number | null
          normalized_status?: string | null
          payment_method_type?: string | null
          platform_fee_amount?: number | null
          provider_payment_id?: string | null
          provider_status?: string | null
          user_id?: string | null
        }
        Update: {
          anticipable?: boolean | null
          anticipated?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_credit_at?: string | null
          financial_account_id?: string | null
          funds_status?: string | null
          gross_amount?: number | null
          id?: string | null
          installment_id?: string | null
          metadata?: Json | null
          net_amount?: number | null
          normalized_status?: string | null
          payment_method_type?: string | null
          platform_fee_amount?: number | null
          provider_payment_id?: string | null
          provider_status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nb_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
        ]
      }
      neurofinance_overview_items_v: {
        Row: {
          amount: number | null
          currency: string | null
          description: string | null
          financial_account_id: string | null
          id: string | null
          item_type: string | null
          metadata: Json | null
          occurred_at: string | null
          overview_group: string | null
          patient_name: string | null
          payment_method: string | null
          reference_id: string | null
          status: string | null
          user_id: string | null
        }
        Relationships: []
      }
      neurofinance_overview_snapshot_v: {
        Row: {
          available_balance: number | null
          calculated_available_balance: number | null
          currency: string | null
          fees_total: number | null
          financial_account_id: string | null
          gross_received: number | null
          is_stale: boolean | null
          last_reconciled_at: string | null
          last_sync_error: string | null
          metadata: Json | null
          pending_receivables: number | null
          provider_as_of: string | null
          reconciliation_difference: number | null
          source: string | null
          total_outflow: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          available_balance?: number | null
          calculated_available_balance?: number | null
          currency?: string | null
          fees_total?: number | null
          financial_account_id?: string | null
          gross_received?: number | null
          is_stale?: boolean | null
          last_reconciled_at?: string | null
          last_sync_error?: string | null
          metadata?: Json | null
          pending_receivables?: number | null
          provider_as_of?: string | null
          reconciliation_difference?: number | null
          source?: string | null
          total_outflow?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          available_balance?: number | null
          calculated_available_balance?: number | null
          currency?: string | null
          fees_total?: number | null
          financial_account_id?: string | null
          gross_received?: number | null
          is_stale?: boolean | null
          last_reconciled_at?: string | null
          last_sync_error?: string | null
          metadata?: Json | null
          pending_receivables?: number | null
          provider_as_of?: string | null
          reconciliation_difference?: number | null
          source?: string | null
          total_outflow?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "neurofinance_overview_snapshots_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: true
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_overview_snapshots_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: true
            referencedRelation: "financial_accounts_safe_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neurofinance_overview_snapshots_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: true
            referencedRelation: "neurofinance_account_state"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_appointment_policy_to_future_occurrences: {
        Args: {
          p_appointment_ids: string[]
          p_idempotency_key: string
          p_policy_version_id: string
          p_reason: string
        }
        Returns: Json
      }
      cancel_appointment_action_plan: {
        Args: {
          p_conversation_id?: string
          p_plan_hash: string
          p_plan_id: string
          p_plan_version: number
        }
        Returns: Json
      }
      cancel_appointment_action_plan_internal: {
        Args: {
          p_actor_user_id: string
          p_conversation_id?: string
          p_plan_hash: string
          p_plan_id: string
          p_plan_version: number
        }
        Returns: Json
      }
      check_appointment_overlap: {
        Args: {
          p_end_time: string
          p_exclude_appointment_id?: string
          p_start_time: string
          p_user_id: string
        }
        Returns: boolean
      }
      claim_appointment_communication_outbox: {
        Args: { p_limit?: number; p_outbox_id?: string }
        Returns: Json
      }
      claim_appointment_effect_outbox: {
        Args: {
          p_effect_type?: string | null
          p_limit?: number
          p_outbox_id?: string | null
        }
        Returns: Json
      }
      claim_waitlist_offer_outbox: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          delivered_at: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          lease_expires_at: string | null
          lease_token: string | null
          next_attempt_at: string
          offer_id: string
          payload: Json
          professional_id: string
          provider: string | null
          provider_message_id: string | null
          status: string
          template_key: string
        }[]
        SetofOptions: {
          from: "*"
          to: "professional_waitlist_offer_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_old_notifications: { Args: never; Returns: number }
      commit_synapse_neuroflow_run: {
        Args: {
          p_description: string
          p_events: Json
          p_run_id: string
          p_steps: Json
          p_title: string
          p_trace: Json
          p_user_id: string
          p_workflow: Json
        }
        Returns: Json
      }
      commit_synapse_neuropulse_run: {
        Args: {
          p_entry_data: Json
          p_events: Json
          p_note_content: string
          p_run_id: string
          p_steps: Json
          p_title: string
          p_trace: Json
          p_user_id: string
        }
        Returns: Json
      }
      complete_appointment_clinical_session: {
        Args: {
          p_appointment_id: string
          p_draft_pending: boolean
          p_idempotency_key: string
          p_session_summary_note_id: string
          p_session_transcript_id: string
        }
        Returns: Json
      }
      complete_appointment_communication_outbox: {
        Args: {
          p_error?: string
          p_lease_token: string
          p_outbox_id: string
          p_provider?: string
          p_provider_message_id?: string
          p_success: boolean
        }
        Returns: undefined
      }
      complete_appointment_effect_outbox: {
        Args: {
          p_lease_token: string
          p_outbox_id: string
          p_result_safe?: Json
        }
        Returns: Json
      }
      complete_synapse_neuroview_run: {
        Args: {
          p_events: Json
          p_result: Json
          p_run_id: string
          p_steps: Json
          p_trace: Json
          p_user_id: string
        }
        Returns: Json
      }
      complete_waitlist_offer_outbox: {
        Args: {
          p_error?: string
          p_lease_token: string
          p_outbox_id: string
          p_provider?: string
          p_provider_message_id?: string
          p_success: boolean
        }
        Returns: boolean
      }
      consume_patient_package_session: {
        Args: {
          p_appointment_id?: string
          p_idempotency_key?: string
          p_package_id: string
          p_patient_id: string
          p_reason?: string
        }
        Returns: Json
      }
      consume_synapse_quota: {
        Args: { p_limit_count?: number; p_user_id: string }
        Returns: {
          allowed: boolean
          limit_count: number
          remaining_count: number
          unlocks_at: string
          used_count: number
        }[]
      }
      create_appointment_policy_version: {
        Args: {
          p_charge_policy: string
          p_effective_at?: string
          p_fiscal_policy: string
          p_free_cancellation_hours: number
          p_free_reschedule_hours: number
          p_idempotency_key?: string
          p_late_cancellation_consequence: string
          p_minimum_patient_reaction_hours: number
          p_no_show_consequence: string
          p_package_credit_policy: string
          p_professional_response_sla_hours: number
          p_reason?: string
          p_timezone?: string
        }
        Returns: Json
      }
      create_appointment_series: {
        Args: {
          p_end_time: string
          p_frequency?: string
          p_location?: string
          p_metadata?: Json
          p_notes?: string
          p_occurrence_count?: number
          p_patient_id: string
          p_psychologist_id?: string
          p_start_time: string
          p_type?: string
        }
        Returns: Json
      }
      create_appointment_series_with_package: {
        Args: {
          p_end_time: string
          p_frequency?: string
          p_location?: string
          p_metadata?: Json
          p_notes?: string
          p_occurrence_count?: number
          p_package_id?: string
          p_patient_id: string
          p_psychologist_id?: string
          p_start_time: string
          p_type?: string
        }
        Returns: Json
      }
      current_user_can_use_feature: {
        Args: { feature_key: string }
        Returns: boolean
      }
      emit_public_anamnesis_notification: {
        Args: { p_anamnesis_id: string; p_progress: number; p_token: string }
        Returns: string
      }
      emit_public_appointment_notification: {
        Args: { p_appointment_id: string; p_event: string; p_token: string }
        Returns: string
      }
      emit_user_notification: {
        Args: {
          p_action_url?: string
          p_category: string
          p_data?: Json
          p_event_id: string
          p_message: string
          p_organization_id?: string
          p_payload?: Json
          p_priority?: string
          p_severity: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      ensure_appointment_policy_snapshot: {
        Args: {
          p_actor_user_id: string
          p_appointment_id: string
          p_source?: string
        }
        Returns: Json
      }
      execute_agenda_action_plan: {
        Args: {
          p_confirmation_channel?: string
          p_plan_hash: string
          p_plan_id: string
          p_plan_version: number
        }
        Returns: Json
      }
      execute_agenda_action_plan_internal: {
        Args: {
          p_actor_user_id: string
          p_confirmation_channel?: string
          p_plan_hash: string
          p_plan_id: string
          p_plan_version: number
        }
        Returns: Json
      }
      execute_appointment_action_plan: {
        Args: {
          p_confirmation_channel?: string
          p_conversation_id?: string
          p_plan_hash: string
          p_plan_id: string
          p_plan_version: number
        }
        Returns: Json
      }
      execute_appointment_action_plan_internal: {
        Args: {
          p_actor_user_id: string
          p_confirmation_channel: string
          p_conversation_id?: string
          p_plan_hash: string
          p_plan_id: string
          p_plan_version: number
        }
        Returns: Json
      }
      execute_package_lifecycle_change_internal: {
        Args: {
          p_action_origin?: string
          p_actor_id: string
          p_anchor_appointment_id?: string
          p_expected_appointment_ids?: string[]
          p_financial_strategy?: string
          p_idempotency_key?: string
          p_operation_type?: string
          p_reason?: string
          p_scope?: string
          p_source_package_id: string
          p_target_package_id?: string
        }
        Returns: Json
      }
      execute_professional_appointment_action: {
        Args: {
          p_action: string
          p_appointment_id: string
          p_idempotency_key: string
          p_reason: string
        }
        Returns: Json
      }
      export_user_data: { Args: never; Returns: Json }
      get_appointment_action_plan_status: {
        Args: { p_plan_id: string; p_plan_version?: number }
        Returns: Json
      }
      get_appointment_action_plan_status_internal: {
        Args: {
          p_actor_user_id: string
          p_plan_id: string
          p_plan_version?: number
        }
        Returns: Json
      }
      get_asaas_account_api_key_for_edge: {
        Args: { p_financial_account_id: string }
        Returns: string
      }
      get_document_storage_usage: {
        Args: never
        Returns: {
          file_count: number
          total_bytes: number
        }[]
      }
      get_effective_appointment_policy: { Args: never; Returns: Json }
      get_financial_management_snapshot: {
        Args: { p_basis?: string; p_month?: string }
        Returns: Json
      }
      get_financial_metrics: {
        Args: { p_end_date: string; p_start_date: string; p_user_id: string }
        Returns: Json
      }
      get_monthly_report_data: {
        Args: { end_date: string; start_date: string }
        Returns: Json
      }
      get_patient_complete_appointment_history: {
        Args: { p_limit?: number; p_offset?: number; p_patient_id: string }
        Returns: Json
      }
      get_public_anamnesis: {
        Args: { p_id: string; p_token: string }
        Returns: Json
      }
      get_safe_appointment_timeline: {
        Args: { p_appointment_id: string }
        Returns: {
          actor_name: string
          channel_name: string
          detail: string
          occurred_at: string
          status_change: string
          title: string
          visual_kind: string
        }[]
      }
      get_waitlist_offer: { Args: { p_token: string }; Returns: Json }
      increment_template_usage: {
        Args: { template_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      mark_all_notifications_as_read: { Args: never; Returns: undefined }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_appointment_invitation_opened: {
        Args: { p_metadata?: Json; p_token_hash: string }
        Returns: string
      }
      mark_notification_as_read: {
        Args: { notification_id: string }
        Returns: undefined
      }
      match_documents: {
        Args: { filter: Json; match_count: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      match_messages_gemini: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          role: string
          similarity: number
        }[]
      }
      match_messages_gemini_for_user: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
          target_user_id: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          role: string
          similarity: number
        }[]
      }
      match_normative_documents: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          title: string
        }[]
      }
      match_professional_waitlist_slot: {
        Args: { p_ends_at: string; p_modality?: string; p_starts_at: string }
        Returns: Json
      }
      neurofinance_normalize_asaas_requirements: {
        Args: {
          account_status?: string
          requirements: Json
          status_source?: string
        }
        Returns: Json
      }
      neurofinance_safe_jsonb: { Args: { input: string }; Returns: Json }
      neurofinance_stage_snapshot: {
        Args: { label: string; provider_status: string }
        Returns: Json
      }
      neurofinance_status_text: {
        Args: { fallback?: string; value: string }
        Returns: string
      }
      neurofinance_status_tone: { Args: { status: string }; Returns: string }
      neurozap_get_instance_credential: {
        Args: { p_instance_name: string; p_user_id: string }
        Returns: string
      }
      neurozap_store_instance_credential: {
        Args: {
          p_instance_api_key: string
          p_instance_name: string
          p_user_id: string
        }
        Returns: undefined
      }
      patch_appointment_clinical_details: {
        Args: {
          p_appointment_id: string
          p_metadata_patch: Json
          p_notes: string | null
          p_notes_set: boolean
        }
        Returns: Json
      }
      patch_appointment_google_sync_effect: {
        Args: {
          p_appointment_id: string
          p_error?: string | null
          p_google_event_id: string | null
          p_google_meet_link: string | null
          p_lease_token: string
          p_outbox_id: string
          p_revision: number
          p_status: string
        }
        Returns: Json
      }
      prepare_agenda_action_plan: {
        Args: {
          p_action: string
          p_idempotency_key: string
          p_input: Json
          p_provenance: Json
        }
        Returns: Json
      }
      prepare_agenda_action_plan_internal: {
        Args: {
          p_actor_user_id: string
          p_idempotency_key: string
          p_input: Json
          p_provenance: Json
        }
        Returns: Json
      }
      prepare_appointment_action_plan: {
        Args: {
          p_action: string
          p_idempotency_key: string
          p_input: Json
          p_provenance: Json
        }
        Returns: Json
      }
      prepare_appointment_action_plan_internal: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_idempotency_key: string
          p_input: Json
          p_plan_id?: string
          p_provenance: Json
        }
        Returns: Json
      }
      prepare_appointment_invitation: {
        Args: {
          p_actor_user_id: string
          p_appointment_id: string
          p_appointment_revision: number
          p_idempotency_key: string
          p_metadata?: Json
          p_token_hash: string
        }
        Returns: Json
      }
      prepare_document_upload: {
        Args: {
          p_bucket: string
          p_category: string
          p_metadata?: Json
          p_mime_type: string
          p_object_key: string
          p_original_name: string
          p_patient_id: string
          p_size_bytes: number
        }
        Returns: {
          bucket: string
          category: string
          checksum_sha256: string | null
          created_at: string
          deleted_at: string | null
          id: string
          metadata: Json
          mime_type: string
          object_key: string
          original_name: string
          patient_id: string | null
          provider: string
          shared_with_patient: boolean
          shared_with_patient_at: string | null
          shared_with_patient_by: string | null
          size_bytes: number
          status: string
          updated_at: string
          uploaded_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "document_files"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      prepare_waitlist_offer: {
        Args: {
          p_ends_at: string
          p_entry_id: string
          p_idempotency_key: string
          p_starts_at: string
        }
        Returns: Json
      }
      preview_agenda_plan: { Args: { p_input: Json }; Returns: Json }
      preview_appointment_policy_application: {
        Args: { p_appointment_ids: string[]; p_policy_version_id: string }
        Returns: Json
      }
      preview_appointment_series: {
        Args: {
          p_end_time: string
          p_frequency?: string
          p_occurrence_count?: number
          p_psychologist_id?: string
          p_start_time: string
        }
        Returns: Json
      }
      preview_availability_change: {
        Args: { p_effective_from?: string; p_windows: Json }
        Returns: Json
      }
      preview_package_lifecycle_change_internal: {
        Args: {
          p_actor_id: string
          p_anchor_appointment_id?: string
          p_financial_strategy?: string
          p_operation_type?: string
          p_scope?: string
          p_source_package_id: string
          p_target_package_id?: string
        }
        Returns: Json
      }
      preview_professional_appointment_action: {
        Args: { p_action: string; p_appointment_id: string }
        Returns: Json
      }
      process_appointment_public_action: {
        Args: {
          p_action: string
          p_metadata?: Json
          p_reason?: string
          p_requested_end_time?: string
          p_requested_start_time?: string
          p_token_hash: string
        }
        Returns: Json
      }
      record_appointment_communication_event: {
        Args: {
          p_action_origin: string
          p_appointment_id: string
          p_event_type: string
          p_idempotency_key?: string
          p_metadata?: Json
        }
        Returns: string
      }
      record_appointment_invitation: {
        Args: {
          p_actor_user_id: string
          p_appointment_id: string
          p_delivery?: Json
          p_token_id: string
        }
        Returns: Json
      }
      refresh_neurofinance_overview_snapshot: {
        Args: { target_financial_account_id: string }
        Returns: undefined
      }
      render_template: {
        Args: { template_id: string; variables_json: Json }
        Returns: string
      }
      request_appointment_outcome_override: {
        Args: {
          p_appointment_id: string
          p_evidence: Json
          p_idempotency_key: string
          p_reason: string
          p_requested_clinical_outcome: string
          p_requested_financial_outcome: string
          p_requested_status: string
        }
        Returns: Json
      }
      resolve_patient_appointment_financial: {
        Args: { p_patient_id: string }
        Returns: Json
      }
      respond_waitlist_offer: {
        Args: { p_response: string; p_token: string }
        Returns: Json
      }
      retry_appointment_effect_outbox: {
        Args: {
          p_error: string
          p_lease_token: string
          p_outbox_id: string
          p_retry_after_seconds?: number | null
          p_retryable?: boolean
          p_wait_for_connection?: boolean
        }
        Returns: Json
      }
      restore_notification: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      review_appointment_reschedule: {
        Args: {
          p_actor_user_id: string
          p_decision: string
          p_metadata?: Json
          p_reason?: string
          p_request_id: string
        }
        Returns: Json
      }
      save_agenda_settings_bundle: {
        Args: { p_availability?: Json; p_policy?: Json }
        Returns: Json
      }
      save_appointment_series_template: {
        Args: {
          p_default_config?: Json
          p_name: string
          p_recurrence_rule: Json
          p_source_patient_id?: string
          p_source_series_id?: string
          p_template_id: string
        }
        Returns: Json
      }
      save_neuroflow_workflow: {
        Args: {
          p_expected_revision?: number
          p_flow_id: string
          p_workflow: Json
        }
        Returns: {
          id: string
          last_saved_at: string
          save_revision: number
          workflow: Json
        }[]
      }
      save_professional_availability: {
        Args: {
          p_effective_from: string
          p_reason?: string
          p_strategy: string
          p_timezone?: string
          p_waitlist_entry_ids?: string[]
          p_waitlist_strategy?: string
          p_windows: Json
        }
        Returns: Json
      }
      search_synapse_workspace: {
        Args: { p_entity_types?: string[]; p_limit?: number; p_query: string }
        Returns: {
          entity_id: string
          entity_type: string
          excerpt: string
          match_reason: string
          occurred_at: string
          patient_id: string
          score: number
          subtitle: string
          title: string
        }[]
      }
      set_professional_waitlist_entry_status: {
        Args: { p_entry_id: string; p_status: string }
        Returns: Json
      }
      store_asaas_account_api_key_for_edge: {
        Args: {
          p_api_key: string
          p_asaas_account_id: string
          p_financial_account_id: string
          p_source?: string
          p_user_id: string
        }
        Returns: undefined
      }
      suggest_agenda_plan_smart_fit: {
        Args: {
          p_allow_shorter?: boolean
          p_input: Json
          p_minimum_duration_minutes?: number
          p_occurrence_number: number
          p_search_days?: number
        }
        Returns: Json
      }
      suggest_appointment_smart_fit: {
        Args: {
          p_allow_shorter?: boolean
          p_anchor_start?: string | null
          p_appointment_id: string
          p_minimum_duration_minutes?: number
          p_search_days?: number
        }
        Returns: Json
      }
      suggest_professional_waitlist_slot: {
        Args: { p_entry_id: string; p_search_days?: number }
        Returns: Json
      }
      transition_financial_entry: {
        Args: {
          p_action: string
          p_amount?: number
          p_effective_at?: string
          p_entry_id: string
          p_idempotency_key?: string
          p_payment_method?: string
          p_reason?: string
        }
        Returns: Json
      }
      trigger_webhook: {
        Args: { event_type_param: string; payload_param: Json }
        Returns: undefined
      }
      update_public_anamnesis: {
        Args: { p_content: Json; p_id: string; p_token: string }
        Returns: undefined
      }
      upsert_professional_waitlist_entry: {
        Args: { p_input: Json }
        Returns: Json
      }
      validate_package_lifecycle_progress_internal: {
        Args: {
          p_actor_id: string
          p_anchor_appointment_id?: string
          p_scope?: string
          p_source_package_id: string
        }
        Returns: Json
      }
      verify_appointment_communication_webhook_secret: {
        Args: { p_candidate: string }
        Returns: boolean
      }
      verify_financial_pin: { Args: { pin_attempt: string }; Returns: boolean }
      verify_notification_webhook_secret: {
        Args: { p_candidate: string; p_channel: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
