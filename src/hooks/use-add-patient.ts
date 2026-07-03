import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { NewPatientFormValues } from "@/lib/validation";
import { parseMoneyToCents } from "./use-patient-insurance-agreements";

const cleanText = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const normalizeEmail = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
};

const cleanDigits = (value?: string | null) => {
  const digits = value?.replace(/\D/g, "");
  return digits || null;
};

const cleanUuid = (value?: string | null) => {
  if (!value || value === "__none") return null;
  return value;
};

const toDateString = (date?: Date) => (date ? format(date, "yyyy-MM-dd") : null);

const parseBillingDay = (value?: string | null) => {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
};

const buildAddress = (patientData: NewPatientFormValues) => {
  const line = [
    cleanText(patientData.street),
    cleanText(patientData.street_number),
    cleanText(patientData.neighborhood),
    cleanText(patientData.city),
    cleanText(patientData.state),
  ].filter(Boolean);

  return cleanText(patientData.address) || (line.length ? line.join(", ") : null);
};

const duplicateEmailMessage = "Este e-mail ja esta em uso em outro prontuario.";

const getErrorText = (error: unknown) => {
  if (!error || typeof error !== "object") return "";
  const record = error as Record<string, unknown>;
  return [record.code, record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
};

const isDuplicateEmailError = (error: unknown) => {
  const text = getErrorText(error);
  return text.includes("patients_email_idx") || (text.includes("duplicate key") && text.includes("email"));
};

const assertEmailAvailable = async (email: string | null, userId: string) => {
  if (!email) return;

  const { data, error } = await supabase
    .from("patients")
    .select("id")
    .eq("user_id", userId)
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data?.id) throw new Error(duplicateEmailMessage);
};

const rollbackPatient = async (patientId: string, userId: string, error: unknown) => {
  const { error: rollbackError } = await supabase
    .from("patients")
    .delete()
    .eq("id", patientId)
    .eq("user_id", userId);
  const message = error instanceof Error ? error.message : "Falha ao salvar dados complementares.";
  if (rollbackError) {
    throw new Error(`${message} O prontuario foi criado, mas a reversao automatica falhou: ${rollbackError.message}`);
  }
  throw new Error(message);
};

const addPatient = async (patientData: NewPatientFormValues, userId: string) => {
  const email = normalizeEmail(patientData.email);
  await assertEmailAvailable(email, userId);

  const relativeContact = [patientData.relative_name, patientData.relative_phone]
    .map(cleanText)
    .filter(Boolean)
    .join(" - ");

  const emergencyContact = [patientData.emergency_name, patientData.emergency_phone]
    .map(cleanText)
    .filter(Boolean)
    .join(" - ");

  const { data: patient, error } = await supabase
    .from("patients")
    .insert({
      user_id: userId,
      name: patientData.name.trim(),
      email,
      phone: cleanText(patientData.mobile_phone || patientData.phone),
      cpf: cleanDigits(patientData.cpf),
      diagnosis: cleanText(patientData.diagnosis),
      notes: cleanText(patientData.notes),
      status: "pending",
      birth_date: toDateString(patientData.birth_date),
      address: buildAddress(patientData),
      emergency_contact: emergencyContact || relativeContact || null,
      payer_type: patientData.payer_type,
      payer_name: cleanText(patientData.payer_name),
      payer_cpf: cleanDigits(patientData.payer_cpf),
      medications: patientData.medications || [],
      group_type: patientData.group_type,
      quick_registration: patientData.quick_registration,
      phone_country_code: cleanText(patientData.phone_country_code) || "+55",
      mobile_phone: cleanText(patientData.mobile_phone),
      landline_phone: cleanText(patientData.landline_phone || patientData.phone),
      rg: cleanText(patientData.rg),
      gender_identity: patientData.gender_identity,
      has_social_name: patientData.has_social_name,
      social_name: patientData.has_social_name ? cleanText(patientData.social_name) : null,
      country: cleanText(patientData.country) || "Brasil",
      postal_code: cleanText(patientData.postal_code),
      city: cleanText(patientData.city),
      state: cleanText(patientData.state),
      street: cleanText(patientData.street),
      street_number: cleanText(patientData.street_number),
      neighborhood: cleanText(patientData.neighborhood),
      complement: cleanText(patientData.complement),
      naturality: cleanText(patientData.naturality),
      education_level: cleanText(patientData.education_level),
      race: cleanText(patientData.race),
      profession: cleanText(patientData.profession),
      relative_name: cleanText(patientData.relative_name),
      relative_relationship: cleanText(patientData.relative_relationship),
      relative_phone: cleanText(patientData.relative_phone),
      referred_by_option_id: cleanUuid(patientData.referrer_option_id),
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao adicionar paciente:", error);
    throw new Error(isDuplicateEmailError(error) ? duplicateEmailMessage : error.message);
  }

  try {
    const sessionValueCents =
      patientData.financial_plan === "insurance"
        ? parseMoneyToCents(patientData.insurance_session_value)
        : patientData.financial_plan === "per_session"
          ? parseMoneyToCents(patientData.session_value)
          : 0;
    const monthlyValueCents = patientData.financial_plan === "monthly"
      ? parseMoneyToCents(patientData.monthly_value)
      : null;

    const { error: financialError } = await supabase
      .from("patient_financial_settings")
      .insert({
        user_id: userId,
        patient_id: patient.id,
        professional_name: cleanText(patientData.professional_name),
        plan_type: patientData.financial_plan,
        session_value_cents: sessionValueCents,
        monthly_value_cents: monthlyValueCents,
        billing_day: patientData.financial_plan === "monthly" ? parseBillingDay(patientData.billing_day) : null,
        insurance_agreement_id: cleanUuid(patientData.insurance_agreement_id),
        insurance_card_number: cleanText(patientData.insurance_card_number),
        insurance_card_expires_at: toDateString(patientData.insurance_card_expires_at),
      });

    if (financialError) throw new Error(financialError.message);

    const hasResponsible = [
      patientData.responsible_name,
      patientData.responsible_email,
      patientData.responsible_mobile_phone,
      patientData.responsible_cpf,
      patientData.responsible_rg,
    ].some((value) => Boolean(cleanText(value)));

    if (hasResponsible || patientData.responsible_use_for_billing_documents) {
      const { error: responsibleError } = await supabase
        .from("patient_responsibles")
        .insert({
          user_id: userId,
          patient_id: patient.id,
          name: cleanText(patientData.responsible_name),
          email: normalizeEmail(patientData.responsible_email),
          phone_country_code: cleanText(patientData.responsible_phone_country_code) || "+55",
          mobile_phone: cleanText(patientData.responsible_mobile_phone),
          cpf: cleanDigits(patientData.responsible_cpf),
          rg: cleanText(patientData.responsible_rg),
          birth_date: toDateString(patientData.responsible_birth_date),
          use_for_billing_documents: patientData.responsible_use_for_billing_documents,
        });

      if (responsibleError) throw new Error(responsibleError.message);
    }

    const { error: preferencesError } = await supabase
      .from("psychologist_patient_preferences")
      .upsert({
        user_id: userId,
        default_quick_registration: patientData.quick_registration,
        default_group_type: patientData.group_type,
        default_country: cleanText(patientData.country) || "Brasil",
        default_financial_plan: patientData.financial_plan,
        default_session_value_cents: patientData.financial_plan === "per_session" ? sessionValueCents : 0,
      }, { onConflict: "user_id" });

    if (preferencesError) throw new Error(preferencesError.message);
  } catch (companionError) {
    await rollbackPatient(patient.id, userId, companionError);
  }

  return patient;
};

export const useAddPatient = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (patientData: NewPatientFormValues) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      return addPatient(patientData, userId);
    },
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.setQueryData(["patients", patient.id], patient);
    },
  });
};
