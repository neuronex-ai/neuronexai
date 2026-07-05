# neurozap-evolution

Authenticated Edge Function used by `/neurozap` to talk to Evolution API without exposing provider credentials to the browser.

Required Supabase secrets:

- `EVOLUTION_API_URL`
- `EVOLUTION_INSTANCE_NAME`
- `EVOLUTION_INSTANCE_API_KEY`
- `EVOLUTION_WEBHOOK_SANDBOX_URL`
- `EVOLUTION_WEBHOOK_PRODUCTION_URL`
- `EVOLUTION_WEBHOOK_MODE` (`sandbox` or `production`)

The UI expects `verify_jwt = true` and calls this function through `supabase.functions.invoke`.
