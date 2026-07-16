import { useAuth } from '@/components/auth/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

export interface ClinicalSessionCompletionInput {
  draftPending: boolean;
  sessionSummaryNoteId?: string | null;
  sessionTranscriptId?: string | null;
}

export interface ClinicalSessionCompletionAttempt {
  appointmentId: string;
  fingerprint: string;
  idempotencyKey: string;
}

type CompletionRpcError = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message: string;
};

type AppointmentCompletionRpcClient = {
  rpc: (
    functionName: 'complete_appointment_clinical_session',
    args: {
      p_appointment_id: string;
      p_session_summary_note_id: string | null;
      p_session_transcript_id: string | null;
      p_draft_pending: boolean;
      p_idempotency_key: string;
    },
  ) => PromiseLike<{ data: unknown; error: CompletionRpcError | null }>;
};

const completionRpcClient = supabase as unknown as AppointmentCompletionRpcClient;

const completionFingerprint = (input: ClinicalSessionCompletionInput) => JSON.stringify([
  input.sessionSummaryNoteId ?? null,
  input.sessionTranscriptId ?? null,
  input.draftPending,
]);

const createIdempotencyKey = (appointmentId: string) =>
  `appointment-clinical-completion:${appointmentId}:${globalThis.crypto.randomUUID()}`;

export const resolveClinicalSessionCompletionAttempt = (
  current: ClinicalSessionCompletionAttempt | null,
  appointmentId: string,
  input: ClinicalSessionCompletionInput,
  keyFactory: (appointmentId: string) => string = createIdempotencyKey,
): ClinicalSessionCompletionAttempt => {
  const fingerprint = completionFingerprint(input);
  if (
    current?.appointmentId === appointmentId
    && current.fingerprint === fingerprint
  ) {
    return current;
  }

  return {
    appointmentId,
    fingerprint,
    idempotencyKey: keyFactory(appointmentId),
  };
};

const INVALIDATED_QUERY_KEYS = [
  'appointmentsByDateRange',
  'appointments',
  'financialEntries',
  'patientTransactions',
  'financialMetrics',
  'advancedCashFlow',
  'monthly-session-metrics',
  'dashboard-activities',
  'dashboardAlerts',
  'smartInsights',
  'churnAlerts',
  'patientAppointments',
] as const;

export const useCompleteAppointmentClinicalSession = (
  appointmentId: string,
  patientId?: string | null,
) => {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const attemptRef = useRef<ClinicalSessionCompletionAttempt | null>(null);

  useEffect(() => {
    if (attemptRef.current?.appointmentId !== appointmentId) {
      attemptRef.current = null;
    }
  }, [appointmentId]);

  const mutation = useMutation({
    mutationFn: async ({
      input,
      idempotencyKey,
    }: {
      input: ClinicalSessionCompletionInput;
      idempotencyKey: string;
    }) => {
      if (!user?.id || !session?.access_token) {
        throw new Error('Usuário não autenticado.');
      }

      const { data, error } = await completionRpcClient.rpc(
        'complete_appointment_clinical_session',
        {
          p_appointment_id: appointmentId,
          p_session_summary_note_id: input.sessionSummaryNoteId ?? null,
          p_session_transcript_id: input.sessionTranscriptId ?? null,
          p_draft_pending: input.draftPending,
          p_idempotency_key: idempotencyKey,
        },
      );

      if (error) {
        console.error('[completeAppointmentClinicalSession]', error);
        throw new Error(error.message);
      }

      return data;
    },
    onSettled: () => {
      for (const queryKey of INVALIDATED_QUERY_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
      void queryClient.invalidateQueries({
        queryKey: ['appointmentLifecycle', appointmentId],
      });
      if (patientId) {
        void queryClient.invalidateQueries({ queryKey: ['patients', patientId] });
        void queryClient.invalidateQueries({ queryKey: ['patientTimeline', patientId] });
      }
    },
  });

  const mutateAsync = mutation.mutateAsync;
  const completeClinicalSession = useCallback(async (
    input: ClinicalSessionCompletionInput,
  ) => {
    const attempt = resolveClinicalSessionCompletionAttempt(
      attemptRef.current,
      appointmentId,
      input,
    );
    attemptRef.current = attempt;

    return mutateAsync({
      input,
      idempotencyKey: attempt.idempotencyKey,
    });
  }, [appointmentId, mutateAsync]);

  const resetClinicalSessionCompletionAttempt = useCallback(() => {
    attemptRef.current = null;
  }, []);

  return {
    completeClinicalSession,
    isCompletingClinicalSession: mutation.isPending,
    resetClinicalSessionCompletionAttempt,
  };
};
