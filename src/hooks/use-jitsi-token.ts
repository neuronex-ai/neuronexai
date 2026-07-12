import { useAuth } from '@/components/auth/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface UseJitsiTokenOptions {
  enabled?: boolean;
  retry?: number;
  decisionKey?: string;
}

export const useJitsiToken = (roomName: string, options?: UseJitsiTokenOptions & { guestName?: string }) => {
  const { user } = useAuth();
  const guestName = options?.guestName;

  return useQuery({
    queryKey: ['jitsiToken', roomName, user?.id, guestName, options?.decisionKey],
    queryFn: async () => {
      if (!user && !guestName) throw new Error('Usuário não autenticado e nome de convidado não fornecido');

      const body = {
        roomName,
        user: user ? {
          id: user.id,
          name: user.user_metadata?.first_name || user.email?.split('@')[0] || 'Terapeuta',
          email: user.email,
          avatar: user.user_metadata?.avatar_url,
        } : {
          id: `guest-${Math.random().toString(36).slice(2, 11)}`,
          name: guestName,
          email: '',
          avatar: '',
          isGuest: true,
        },
      };

      const { data, error } = await supabase.functions.invoke('generate-jitsi-token', { body });
      if (error) throw new Error(`Falha ao gerar token Jitsi: ${error.message}`);
      if (!data?.token) throw new Error('A resposta da função de token estava malformada.');
      return data.token as string;
    },
    enabled: (options?.enabled ?? true) && (!!user || !!guestName) && !!roomName,
    staleTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    retry: options?.retry ?? 1,
  });
};

export type SessionTranscriptModality = 'online' | 'in_person';
export type SessionTranscriptProvider = 'jitsi' | 'browser_speech' | 'manual' | 'mixed';
export type SessionTranscriptStatus = 'draft' | 'recording' | 'paused' | 'finalizing' | 'completed' | 'error' | 'abandoned';
export type SessionCaptureState = 'idle' | 'restoring' | 'awaiting_consent' | 'ready' | 'recording' | 'paused' | 'reconnecting' | 'finalizing' | 'completed' | 'error';
export type SessionTranscriptConsentStatus = 'pending' | 'granted' | 'declined' | 'revoked';
export type SessionTranscriptConsentMethod = 'verbal' | 'written' | 'digital' | 'legacy';
export type SessionTranscriptSource = 'jitsi' | 'browser_speech' | 'manual' | 'imported';
export type SessionTranscriptSyncState = 'idle' | 'pending' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SessionTranscriptRecord {
  id: string;
  user_id: string;
  patient_id: string | null;
  appointment_id: string | null;
  modality: SessionTranscriptModality;
  provider: SessionTranscriptProvider;
  status: SessionTranscriptStatus;
  language: string;
  consent_status: SessionTranscriptConsentStatus;
  consent_method: SessionTranscriptConsentMethod | null;
  consent_notes: string | null;
  consent_recorded_at: string | null;
  started_at: string | null;
  paused_at: string | null;
  ended_at: string | null;
  finalized_at: string | null;
  reviewed_at: string | null;
  summary_note_id: string | null;
  retention_policy: 'manual' | 'keep' | 'delete_after_summary';
  retention_until: string | null;
  last_synced_at: string | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SessionTranscriptSegment {
  id?: string;
  transcript_id: string;
  user_id: string;
  client_segment_id: string;
  sequence: number;
  source: SessionTranscriptSource;
  speaker_label: string | null;
  speaker_id: string | null;
  text: string;
  is_final: boolean;
  started_at_ms: number | null;
  ended_at_ms: number | null;
  confidence: number | null;
  captured_at: string;
  metadata: Record<string, unknown>;
  created_at?: string;
}

export interface SessionTranscriptRecoverySnapshot {
  version: 1;
  key: string;
  record: SessionTranscriptRecord | null;
  segments: SessionTranscriptSegment[];
  pendingSegments: SessionTranscriptSegment[];
  savedAt: string;
}

const RECOVERY_DB = 'neuronex-session-recovery';
const RECOVERY_STORE = 'transcripts';
const RECOVERY_VERSION = 1;

export const createSessionTranscriptUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
};

const openRecoveryDb = async (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RECOVERY_DB, RECOVERY_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECOVERY_STORE)) database.createObjectStore(RECOVERY_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveSessionTranscriptRecovery = async (snapshot: SessionTranscriptRecoverySnapshot) => {
  try {
    const database = await openRecoveryDb();
    if (!database) throw new Error('indexeddb_unavailable');
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(RECOVERY_STORE, 'readwrite');
      transaction.objectStore(RECOVERY_STORE).put(snapshot);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  } catch {
    localStorage.setItem(`session-recovery:${snapshot.key}`, JSON.stringify(snapshot));
  }
};

export const loadSessionTranscriptRecovery = async (key: string): Promise<SessionTranscriptRecoverySnapshot | null> => {
  try {
    const database = await openRecoveryDb();
    if (database) {
      const snapshot = await new Promise<SessionTranscriptRecoverySnapshot | undefined>((resolve, reject) => {
        const request = database.transaction(RECOVERY_STORE, 'readonly').objectStore(RECOVERY_STORE).get(key);
        request.onsuccess = () => resolve(request.result as SessionTranscriptRecoverySnapshot | undefined);
        request.onerror = () => reject(request.error);
      });
      database.close();
      if (snapshot) return snapshot;
    }
  } catch {
    // Fallback below.
  }

  const raw = localStorage.getItem(`session-recovery:${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionTranscriptRecoverySnapshot;
  } catch {
    return null;
  }
};

export const deleteSessionTranscriptRecovery = async (key: string) => {
  try {
    const database = await openRecoveryDb();
    if (database) {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(RECOVERY_STORE, 'readwrite');
        transaction.objectStore(RECOVERY_STORE).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    }
  } catch {
    // Fallback cleanup below.
  }
  localStorage.removeItem(`session-recovery:${key}`);
};

export const mergeTranscriptSegments = (...collections: SessionTranscriptSegment[][]) => {
  const segments = new Map<string, SessionTranscriptSegment>();
  collections.flat().forEach((segment) => {
    const current = segments.get(segment.client_segment_id);
    if (!current || (!current.id && segment.id)) segments.set(segment.client_segment_id, segment);
  });
  return Array.from(segments.values()).sort((left, right) => left.sequence - right.sequence);
};

export const fetchOpenSessionTranscript = async (userId: string, appointmentId: string) => {
  const { data, error } = await supabase
    .from('session_transcripts')
    .select('*')
    .eq('user_id', userId)
    .eq('appointment_id', appointmentId)
    .is('deleted_at', null)
    .in('status', ['draft', 'recording', 'paused', 'finalizing', 'error'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as SessionTranscriptRecord | null;
};

export const fetchSessionTranscriptSegments = async (userId: string, transcriptId: string) => {
  const { data, error } = await supabase
    .from('session_transcript_segments')
    .select('*')
    .eq('user_id', userId)
    .eq('transcript_id', transcriptId)
    .order('sequence', { ascending: true });
  if (error) throw error;
  return (data || []) as SessionTranscriptSegment[];
};

export const upsertSessionTranscript = async (record: SessionTranscriptRecord) => {
  const { error } = await supabase.from('session_transcripts').upsert(record, { onConflict: 'id' });
  if (error) throw error;
};

export const upsertSessionTranscriptSegments = async (segments: SessionTranscriptSegment[]) => {
  if (segments.length === 0) return;
  const { error } = await supabase
    .from('session_transcript_segments')
    .upsert(segments, { onConflict: 'transcript_id,client_segment_id' });
  if (error) throw error;
};
