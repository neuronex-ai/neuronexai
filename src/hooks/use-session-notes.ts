import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AISummary, SessionNote } from '@/types';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { toast } from 'sonner';
import { repairTextEncodingDeep } from '@/lib/text-encoding';

interface SessionNotesOptions {
  limit?: number;
}

const fetchSessionNotes = async (patientId: string, userId: string, options: SessionNotesOptions = {}): Promise<SessionNote[]> => {
  let query = supabase
    .from('session_notes')
    .select('*')
    .eq('patient_id', patientId)
    .eq('user_id', userId)
    .or('review_status.is.null,review_status.eq.confirmed')
    .order('created_at', { ascending: false });

  if (options.limit && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar anotações da sessão:', error);
    throw new Error(error.message);
  }

  return repairTextEncodingDeep((data || []) as SessionNote[]);
};

export const useSessionNotes = (patientId: string, options: SessionNotesOptions = {}) => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<SessionNote[], Error>({
    queryKey: ['sessionNotes', patientId, userId, options.limit || 'all'],
    queryFn: () => fetchSessionNotes(patientId, userId!, options),
    enabled: !!patientId && !!userId, // Only run if patientId and userId are provided
  });
};

const fetchPendingSessionReviews = async (patientId: string, userId: string): Promise<SessionNote[]> => {
  const { data, error } = await supabase
    .from('session_notes')
    .select('*')
    .eq('patient_id', patientId)
    .eq('user_id', userId)
    .eq('review_status', 'pending_review')
    .order('review_due_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar revisões pendentes:', error);
    throw new Error(error.message);
  }

  return repairTextEncodingDeep((data || []) as SessionNote[]);
};

export const usePendingSessionReviews = (patientId: string) => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<SessionNote[], Error>({
    queryKey: ['pendingSessionReviews', patientId, userId],
    queryFn: () => fetchPendingSessionReviews(patientId, userId!),
    enabled: !!patientId && !!userId,
  });
};

export const useConfirmSessionReview = (patientId: string) => {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('session_notes')
        .update({
          review_status: 'confirmed',
          confirmed_at: now,
          confirmed_by: userId,
          locked_at: now,
        })
        .eq('id', noteId)
        .eq('patient_id', patientId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as SessionNote;
    },
    onSuccess: () => {
      toast.success('Resumo confirmado e movido para o histórico.');
      queryClient.invalidateQueries({ queryKey: ['pendingSessionReviews', patientId] });
      queryClient.invalidateQueries({ queryKey: ['sessionNotes', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patientTimeline', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patientSessionSummary'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível confirmar o resumo.');
    },
  });
};

export const useUpdatePendingSessionReview = (patientId: string) => {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ note, summary }: { note: SessionNote; summary: AISummary }) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      if (note.review_status !== 'pending_review') throw new Error('Este resumo já foi confirmado.');
      if (!note.review_due_at || new Date(note.review_due_at).getTime() <= Date.now()) {
        throw new Error('O prazo de 48h terminou. Este resumo não pode mais ser editado.');
      }

      const currentSummary = note.ai_summary || null;
      const summaryWasEdited = JSON.stringify(summary) !== JSON.stringify(currentSummary);
      if (!summaryWasEdited) return note;

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('session_notes')
        .update({
          ai_summary: summary,
          original_ai_summary: note.original_ai_summary || currentSummary || summary,
          original_transcription: note.original_transcription || note.transcription || null,
          ai_summary_edited: true,
          ai_summary_edited_at: now,
          ai_summary_edited_by: userId,
          ai_summary_edit_count: (note.ai_summary_edit_count || 0) + 1,
        })
        .eq('id', note.id)
        .eq('patient_id', patientId)
        .eq('user_id', userId)
        .eq('review_status', 'pending_review')
        .gt('review_due_at', now)
        .select()
        .single();

      if (error) {
        throw new Error(error.code === 'PGRST116'
          ? 'O prazo de 48h terminou. Este resumo não pode mais ser editado.'
          : error.message);
      }
      return data as SessionNote;
    },
    onSuccess: (note) => {
      if (note.ai_summary_edited) {
        toast.success('Resumo atualizado. A versão original foi preservada.');
      }
      queryClient.invalidateQueries({ queryKey: ['pendingSessionReviews', patientId] });
      queryClient.invalidateQueries({ queryKey: ['sessionNotes', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patientTimeline', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patientSessionSummary'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o resumo.');
    },
  });
};
