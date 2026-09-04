import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { getUserFacingErrorMessage } from '@/lib/user-facing-error';
import { PersonalNote } from '@/types';
import { toast } from 'sonner';

const getNotionPageUrl = (pageId: string) =>
  `https://www.notion.so/${pageId.replace(/-/g, '')}`;

const hydrateNotionChildPageLinks = (content: string) => {
  if (!content || !content.toLowerCase().includes('<note-link')) return content;

  return content.replace(/<note-link\b[^>]*>/gi, (tag) => {
    const pageIdMatch = tag.match(/\bnotionpageid=["']([^"']+)["']/i);
    if (!pageIdMatch?.[1]) return tag;

    const pageUrl = getNotionPageUrl(pageIdMatch[1]);
    const hrefMatch = tag.match(/\bhref=["']([^"']*)["']/i);
    const currentHref = hrefMatch?.[1]?.trim();

    if (currentHref && currentHref !== '#') return tag;
    if (hrefMatch) {
      return tag.replace(/\bhref=["'][^"']*["']/i, `href="${pageUrl}"`);
    }

    return tag.replace(/>$/, ` href="${pageUrl}">`);
  });
};

const normalizePersonalNote = (note: any): PersonalNote => ({
  ...note,
  content: hydrateNotionChildPageLinks(note.content || ''),
  patient_name: note.patient?.name ?? note.patient_name,
});

const fetchNotes = async (userId: string): Promise<PersonalNote[]> => {
  const { data, error } = await supabase
    .from('personal_notes')
    .select(`
      *,
      patient:patient_id(name)
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map(normalizePersonalNote);
};

const createNote = async (note: Partial<PersonalNote>, userId: string) => {
  const { data, error } = await supabase
    .from('personal_notes')
    .insert({ ...note, user_id: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return normalizePersonalNote(data);
};

const updateNote = async (id: string, updates: Partial<PersonalNote>, userId: string) => {
  const { data, error } = await supabase
    .from('personal_notes')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return normalizePersonalNote(data);
};

const deleteNote = async (id: string, userId: string) => {
  const { error } = await supabase
    .from('personal_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
};

export const usePersonalNotes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = ['personalNotes', userId] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => fetchNotes(userId!),
    enabled: !!userId,
  });

  const createMutation = useMutation({
    mutationFn: (note: Partial<PersonalNote>) => {
      if (!userId) throw new Error('Usuário não autenticado');
      return createNote(note, userId);
    },
    onSuccess: (createdNote) => {
      queryClient.setQueryData<PersonalNote[]>(queryKey, (current = []) => [
        createdNote,
        ...current.filter((note) => note.id !== createdNote.id),
      ]);
    },
    onError: (error) => {
      console.error('[usePersonalNotes] Falha ao criar nota', error);
      toast.error(getUserFacingErrorMessage(error, 'save'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<PersonalNote> }) => {
      if (!userId) throw new Error('Usuário não autenticado');
      return updateNote(id, updates, userId);
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousNotes = queryClient.getQueryData<PersonalNote[]>(queryKey);

      queryClient.setQueryData<PersonalNote[]>(queryKey, (current = []) =>
        current.map((note) =>
          note.id === id
            ? { ...note, ...updates, updated_at: new Date().toISOString() }
            : note
        )
      );

      return { previousNotes };
    },
    onSuccess: (updatedNote) => {
      queryClient.setQueryData<PersonalNote[]>(queryKey, (current = []) =>
        current
          .map((note) =>
            note.id === updatedNote.id
              ? { ...note, ...updatedNote, patient_name: note.patient_name }
              : note
          )
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      );
    },
    onError: (error, _variables, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(queryKey, context.previousNotes);
      }
      console.error('[usePersonalNotes] Falha ao atualizar nota', error);
      toast.error(getUserFacingErrorMessage(error, 'save'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!userId) throw new Error('Usuário não autenticado');
      return deleteNote(id, userId);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousNotes = queryClient.getQueryData<PersonalNote[]>(queryKey);
      queryClient.setQueryData<PersonalNote[]>(queryKey, (current = []) =>
        current.filter((note) => note.id !== id)
      );
      return { previousNotes };
    },
    onError: (error, _id, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(queryKey, context.previousNotes);
      }
      console.error('[usePersonalNotes] Falha ao excluir nota', error);
      toast.error(getUserFacingErrorMessage(error, 'save'));
    },
    onSuccess: () => {
      toast.success('Nota excluída.');
    },
  });

  return {
    notes: query.data,
    isLoading: query.isLoading,
    createNote: createMutation.mutateAsync,
    updateNote: updateMutation.mutate,
    updateNoteAsync: updateMutation.mutateAsync,
    deleteNote: deleteMutation.mutate,
    isCreatingNote: createMutation.isPending,
    isUpdatingNote: updateMutation.isPending,
  };
};
