-- Cover Agenda v2 foreign keys that are not the leading columns of an
-- existing lookup index. Besides improving joins, these indexes keep deletes
-- and key updates from scanning the related tables.

create index if not exists appointment_action_plan_events_actor_idx
  on public.appointment_action_plan_events (actor_user_id);
create index if not exists appointment_action_plan_events_patient_idx
  on public.appointment_action_plan_events (patient_id);
create index if not exists appointment_action_plans_confirmed_by_idx
  on public.appointment_action_plans (confirmed_by);
create index if not exists appointment_action_plans_patient_idx
  on public.appointment_action_plans (patient_id);
create index if not exists appointment_action_plans_series_idx
  on public.appointment_action_plans (series_id);

create index if not exists appointment_occurrence_overrides_appointment_idx
  on public.appointment_occurrence_overrides (appointment_id);
create index if not exists appointment_occurrence_overrides_created_by_idx
  on public.appointment_occurrence_overrides (created_by);

create index if not exists appointment_series_availability_version_idx
  on public.appointment_series (availability_version_id);
create index if not exists appointment_series_template_version_idx
  on public.appointment_series (template_version_id);
create index if not exists appointment_series_template_versions_created_by_idx
  on public.appointment_series_template_versions (created_by);
create index if not exists appointment_series_template_versions_professional_idx
  on public.appointment_series_template_versions (professional_id);
create index if not exists appointment_series_templates_source_patient_idx
  on public.appointment_series_templates (source_patient_id);
create index if not exists appointment_series_templates_source_series_idx
  on public.appointment_series_templates (source_series_id);

create index if not exists appointment_slot_holds_patient_idx
  on public.appointment_slot_holds (patient_id);
create index if not exists appointment_slot_holds_waitlist_entry_idx
  on public.appointment_slot_holds (waitlist_entry_id);

create index if not exists professional_availability_exceptions_version_idx
  on public.professional_availability_exceptions (availability_version_id);
create index if not exists professional_availability_impacts_appointment_idx
  on public.professional_availability_impacts (appointment_id);
create index if not exists professional_availability_impacts_version_idx
  on public.professional_availability_impacts (availability_version_id);
create index if not exists professional_availability_impacts_waitlist_idx
  on public.professional_availability_impacts (waitlist_entry_id);
create index if not exists professional_availability_versions_created_by_idx
  on public.professional_availability_versions (created_by);

create index if not exists professional_waitlist_entries_availability_idx
  on public.professional_waitlist_entries (availability_version_id);
create index if not exists professional_waitlist_entries_created_by_idx
  on public.professional_waitlist_entries (created_by);
create index if not exists professional_waitlist_entries_patient_idx
  on public.professional_waitlist_entries (patient_id);
create index if not exists professional_waitlist_events_offer_idx
  on public.professional_waitlist_events (offer_id);
create index if not exists professional_waitlist_events_entry_fk_idx
  on public.professional_waitlist_events (waitlist_entry_id);
create index if not exists professional_waitlist_offer_outbox_offer_idx
  on public.professional_waitlist_offer_outbox (offer_id);
create index if not exists professional_waitlist_offer_outbox_professional_idx
  on public.professional_waitlist_offer_outbox (professional_id);
create index if not exists professional_waitlist_offers_appointment_idx
  on public.professional_waitlist_offers (accepted_appointment_id);
create index if not exists professional_waitlist_offers_hold_idx
  on public.professional_waitlist_offers (hold_id);
create index if not exists professional_waitlist_offers_patient_idx
  on public.professional_waitlist_offers (patient_id);
create index if not exists professional_waitlist_offers_entry_idx
  on public.professional_waitlist_offers (waitlist_entry_id);
create index if not exists professional_waitlist_windows_entry_idx
  on public.professional_waitlist_windows (waitlist_entry_id);
