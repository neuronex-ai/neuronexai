import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export interface TeleconsultationInviteResult {
  inviteId: string;
  inviteToken: string;
  meetLink: string;
  expiresAt: string;
}

const isSecureInviteLink = (value?: string | null) =>
  Boolean(value && /\/join\/[a-f0-9]{64}$/i.test(value));

export const useTeleconsultationInvite = (
  appointmentId: string,
  existingLink?: string | null,
  enabled = true,
) => useQuery({
  queryKey: ['teleconsultationInvite', appointmentId, existingLink],
  enabled: enabled && Boolean(appointmentId),
  staleTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
  retry: 1,
  placeholderData: isSecureInviteLink(existingLink)
    ? {
      inviteId: '',
      inviteToken: existingLink!.split('/').at(-1) || '',
      meetLink: existingLink!,
      expiresAt: '',
    }
    : undefined,
  queryFn: async () => {
    const { data, error } = await supabase.functions.invoke<TeleconsultationInviteResult>(
      'ensure-teleconsultation-invite',
      { body: { appointmentId } },
    );
    if (error) throw new Error(error.message);
    if (!data?.meetLink || !isSecureInviteLink(data.meetLink)) {
      throw new Error('O servidor não retornou um convite seguro.');
    }
    return data;
  },
});

export { isSecureInviteLink };
