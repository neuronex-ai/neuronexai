import { createClient } from '@supabase/supabase-js';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase-config';

/**
 * Public teleconsultations deliberately use an isolated, in-memory Auth client.
 * An anonymous participant must never replace another active session in the browser.
 */
export const createTeleconsultationGuestClient = () => createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

export type TeleconsultationGuestClient = ReturnType<typeof createTeleconsultationGuestClient>;
