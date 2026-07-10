alter table if exists public.synapse_voice_sessions
  alter column tts_provider set default 'deepgram-elevenlabs';
