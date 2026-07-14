# NeuroNex Architecture

Last updated: 2026-07-14

This document is the current source of truth for agents and maintainers. Older provider experiments are legacy and must not be reintroduced unless the product direction changes explicitly.

## Current Stack

| Layer | Current choice |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, React Router |
| UI | Tailwind CSS, Radix UI, shadcn/ui, lucide-react |
| State/data | TanStack Query, Supabase JS |
| Database/Auth/RLS | Supabase Cloud |
| Edge backend | Supabase Edge Functions |
| Private object storage | Cloudflare R2 |
| Financial provider | Asaas BaaS v3, identified in financial flows as the payment-services provider |
| Financial product surface | NeuroFinance, the NeuroNex product/interface for financial workflows |
| NFS-e provider | Asaas fiscal/NFS-e flows presented with clear provider attribution |
| AI | Gemini/Synapse Edge Functions |
| Calendar/document integrations | Google Calendar/Drive/Docs where still connected |
| Teleconsulta | Current Jitsi/JaaS flow plus hidden legacy evaluation route |
| WhatsApp/NeuroZap | Planned Desktop Beta surface at `/neurozap`; preserve even while it is hidden from the navbar |

## Architecture Rules

- NeuroFinance is the only financial product surface, but it must not hide the provider role. It uses Asaas BaaS v3 for psychologist subscriptions, subaccounts, patient charges, Pix/boletos/cards, payouts, fiscal data, and NFS-e.
- NeuroNex is the technology platform. It must not be described as a bank, payment institution, or holder of client funds.
- Asaas must be clearly identified in onboarding, financial screens, terms, contracts, Pix/boleto/card flows, payouts, receipts, and patient billing as the provider responsible for contracted financial services.
- Supabase stores relational metadata, Auth, RLS, realtime, and Edge Functions. It is not the primary document store.
- Cloudflare R2 stores private document bytes. Supabase stores metadata and authorizes uploads/downloads through Edge Functions and short-lived signed URLs.
- Documents, notes attachments, AI chat files, portal patient files, and backfilled legacy objects must use R2 unless explicitly marked public and non-sensitive.
- Patient accounts and professional accounts are separate roles. Patients must land in `/portal`; professionals must not enter patient portal without an explicit patient relationship.
- Clinic/multi-professional product surfaces are postponed. Do not keep or add Plano Clínica dashboards, team management, clinic reports, or organization settings in the active product.

## Active Route Families

| Family | Route examples | Status |
| --- | --- | --- |
| Auth | `/auth`, `/reset-password`, `/email-confirmed` | Active |
| Professional app | `/dashboard`, `/agenda`, `/pacientes`, `/notas`, `/financeiro/*`, `/ajustes`, `/teleconsulta` | Active |
| Patient portal | `/portal/*`, `/portal/convite/:token`, `/portal/ativar` | Active |
| Public/semi-public workflows | `/confirmar-agendamento/:token`, `/join/:appointmentId`, `/payment/callback`, `/anamnese-externa/:id`, `/help` | Active |
| Planned Desktop Beta | `/neurozap` | Preserve; not legacy even while hidden from the navbar |
| Hidden evaluation | `/teleconsulta-antiga`, `/notas-mobile-antiga` | Kept intentionally pending a dedicated product review |

## Legacy To Remove Or Keep Removed

These are definitive legacy surfaces in this project:

- Stripe, Stripe Connect, Stripe Checkout, Stripe webhooks, Stripe payout/account functions, and Stripe post-payment assumptions.
- C6 Bank and any C6 payment/Pix/boleto/account schema.
- Focus NFe and Focus-specific API keys, fields, functions, or UI.
- Twilio SMS.
- ElevenLabs.
- MoltBook and Synapse Heartbeat.
- Google Sheets export/sync. Google Calendar/Drive/Docs may remain when used by current integrations.
- Microsoft To Do and Todoist integrations. Their local UI, hooks, assets, and Edge Function sources were removed after the product decision on 2026-07-14. Historical database structures remain until a dedicated, reversible Supabase audit.
- Public institutional pages/routes: `/about`, `/blog`, `/careers`, `/neurobank`.
- Clinic plan routes and modules: `/clinic-dashboard`, `/relatorios`, `reports/`, organization/team management, clinic performance reports, monthly clinical report automation.

Historical migrations may still mention old providers because migration history is append-only. Active source code, Edge Functions, config, and product docs should not depend on them.

## Supabase And R2 Contracts

- R2 credentials are server-only Edge Function secrets. They must never appear in Vite/browser env vars or frontend bundles.
- R2 object access uses authenticated Edge Functions such as upload confirmation, download URL creation, and deletion.
- Supabase Storage is not used for private documents. The remaining active Storage bucket is `avatars` for profile images; legacy sandbox buckets such as `files_psico`, `chat_attachments`, and `downloads` were removed after R2 validation/backfill.
- Edge Functions must default to `verify_jwt = true`. Exceptions must be explicitly classified as webhook, OAuth callback, public invite/availability endpoint, or maintenance endpoint with its own shared secret.
- Security-definer functions must not be public accidental APIs. Prefer owner checks, restricted grants, and advisor verification.

## Finance And Fiscal Contracts

- Professional subscriptions to NeuroNex use Asaas checkout/subscription records through `create-checkout-session`, `verify-checkout-session`, `asaas-webhook`, and entitlement sync.
- Psychologist financial accounts/subaccounts use Asaas BaaS v3 through NeuroFinance onboarding and account sync functions.
- Patient charges use NeuroFinance payment creation/actions and `nb_payments` as the financial source of truth for provider-backed payments.
- Financial UI, receipts, and patient billing must make the Asaas role unambiguous. Use official Asaas marks only from approved assets and keep NeuroFinance as product branding, not as a substitute for provider attribution.
- Operational webhooks are not evidence of payout/withdrawal validation by themselves. Payout validation must be confirmed by the Asaas-specific withdrawal webhook configuration or by API IP allowlisting.
- NFS-e issuance uses `asaas-invoices` plus shared Asaas NFS-e helpers. Provider-neutral columns should use `nfse_*`; Focus-specific columns are legacy.
- Financial management reports inside `/financeiro` are current psychologist cashflow views and are not the old Plano Clínica reports.

## Current Cleanup Notes

- Clinic/team UI has been removed from active settings. Any future clinic product should be rebuilt from a new design/schema.
- Monthly clinical report automation has been removed from active UI/functions. Patient clinical notes, prontuario, summaries, and documents remain core product.
- Some financial tables may still keep dormant `clinic_id` scope columns while RLS and reconciliation are simplified in a dedicated future migration. Do not use those fields for new features.
- CRP handling currently validates and formats the text locally; it does not confirm an active registration with the CFP. UI and generated copy must say "CRP informado" or "formato válido", never "identidade verificada", until a trustworthy verification flow is rebuilt. A historical `validate-crp` function may still exist remotely and must be reconciled during the Supabase audit.
