# NeuroNex Architecture

Last updated: 2026-07-14

This document is the current source of truth for agents and maintainers.

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
| Teleconsulta | Current Jitsi/JaaS flow plus hidden evaluation route |
| WhatsApp/NeuroZap | Planned Desktop Beta surface at `/neurozap`, currently hidden from the navbar |

## Architecture Rules

- NeuroFinance is the only financial product surface, but it must not hide the provider role. It uses Asaas BaaS v3 for psychologist subscriptions, subaccounts, patient charges, Pix/boletos/cards, payouts, fiscal data, and NFS-e.
- NeuroNex is the technology platform. It must not be described as a bank, payment institution, or holder of client funds.
- Asaas must be clearly identified in onboarding, financial screens, terms, contracts, Pix/boleto/card flows, payouts, receipts, and patient billing as the provider responsible for contracted financial services.
- Supabase stores relational metadata, Auth, RLS, realtime, and Edge Functions. It is not the primary document store.
- Cloudflare R2 stores private document bytes. Supabase stores metadata and authorizes uploads/downloads through Edge Functions and short-lived signed URLs.
- Documents, notes attachments, AI chat files, portal patient files, and imported historical objects use R2 unless explicitly marked public and non-sensitive.
- Patient accounts and professional accounts are separate roles. Patients must land in `/portal`; professionals must not enter patient portal without an explicit patient relationship.
- Clinic and multi-professional product surfaces are currently outside the active product scope.

## Active Route Families

| Family | Route examples | Status |
| --- | --- | --- |
| Auth | `/auth`, `/reset-password`, `/email-confirmed` | Active |
| Professional app | `/dashboard`, `/agenda`, `/pacientes`, `/notas`, `/financeiro/*`, `/ajustes`, `/teleconsulta` | Active |
| Patient portal | `/portal/*`, `/portal/convite/:token`, `/portal/ativar` | Active |
| Public/semi-public workflows | `/confirmar-agendamento/:token`, `/join/:appointmentId`, `/payment/callback`, `/anamnese-externa/:id`, `/help` | Active |
| Planned Desktop Beta | `/neurozap` | Planned and currently hidden from the navbar |
| Hidden evaluation | `/teleconsulta-antiga`, `/notas-mobile-antiga` | Pending a dedicated product review |

## Supabase And R2 Contracts

- R2 credentials are server-only Edge Function secrets. They must never appear in Vite/browser env vars or frontend bundles.
- R2 object access uses authenticated Edge Functions such as upload confirmation, download URL creation, and deletion.
- Supabase Storage is not used for private documents. Its remaining active bucket is `avatars`, used for profile images.
- Edge Functions must default to `verify_jwt = true`. Exceptions must be explicitly classified as webhook, OAuth callback, public invite/availability endpoint, or maintenance endpoint with its own shared secret.
- Security-definer functions must not be public accidental APIs. Prefer owner checks, restricted grants, and advisor verification.

## Finance And Fiscal Contracts

- Professional subscriptions to NeuroNex use Asaas checkout/subscription records through `create-checkout-session`, `verify-checkout-session`, `asaas-webhook`, and entitlement sync.
- Psychologist financial accounts/subaccounts use Asaas BaaS v3 through NeuroFinance onboarding and account sync functions.
- Patient charges use NeuroFinance payment creation/actions and `nb_payments` as the financial source of truth for provider-backed payments.
- Financial UI, receipts, and patient billing must make the Asaas role unambiguous. Use official Asaas marks only from approved assets and keep NeuroFinance as product branding, not as a substitute for provider attribution.
- Operational webhooks are not evidence of payout/withdrawal validation by themselves. Payout validation must be confirmed by the Asaas-specific withdrawal webhook configuration or by API IP allowlisting.
- NFS-e issuance uses `asaas-invoices` plus shared Asaas NFS-e helpers. Provider-neutral columns use the `nfse_*` prefix.
- Financial management reports inside `/financeiro` are the current psychologist cashflow views.

## Known Pending Audits

- Some financial tables may still keep dormant `clinic_id` scope columns. Their dependencies, data, policies, and restoration strategy belong to the database-column audit.
- CRP handling currently validates and formats text locally; it does not confirm an active registration with the CFP. User-facing wording is limited to "CRP informado" and "formato válido". The state of any older remote validation function belongs to the Edge Function audit.
