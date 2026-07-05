# neurozap-evolution

Authenticated Edge Function used by `/neurozap` to talk to Evolution API without exposing provider credentials to the browser.

Required Supabase secrets:

- `EVOLUTION_API_URL`
- `EVOLUTION_GLOBAL_API_KEY`
- `EVOLUTION_WEBHOOK_SANDBOX_BASE` or `EVOLUTION_WEBHOOK_SANDBOX_URL`
- `EVOLUTION_WEBHOOK_PRODUCTION_BASE` or `EVOLUTION_WEBHOOK_PRODUCTION_URL`
- `EVOLUTION_WEBHOOK_MODE` (`sandbox` or `production`)

`EVOLUTION_INSTANCE_API_KEY` is only used as a legacy fallback. New psychologist instances store their per-instance API key in
`private.neurozap_instance_credentials`, never in browser-readable tables.

The UI expects `verify_jwt = true` and calls this function through `supabase.functions.invoke`.
