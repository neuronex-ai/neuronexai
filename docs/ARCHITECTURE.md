# NeuroNex Architecture

Last updated: 2026-09-01

This document is the current source of truth for agents and maintainers.

Its primary product scope is the **psychologist desktop application**. Public pages, the patient portal, and mobile surfaces may share infrastructure, but they must not override the desktop psychologist architecture described here.

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
| AI | Synapse through Edge Functions and its current model/provider adapters |
| Calendar/document integrations | Google Calendar/Drive/Docs where still connected |
| Teleconsulta | Current Jitsi/JaaS flow plus hidden evaluation route |
| WhatsApp/NeuroZap | Desktop Beta surface at `/neurozap`, with availability controlled by product state |

## Architecture Rules

- The psychologist desktop is the canonical professional experience. Desktop navigation, desktop Notes/NeuroBox behavior, professional routes, and their connected data flows take precedence over legacy mobile or prototype implementations when product behavior conflicts.
- NeuroFinance is the only financial product surface, but it must not hide the provider role. It uses Asaas BaaS v3 for psychologist subscriptions, subaccounts, patient charges, Pix/boletos/cards, payouts, fiscal data, and NFS-e.
- NeuroNex is the technology platform. It must not be described as a bank, payment institution, or holder of client funds.
- Asaas must be clearly identified in onboarding, financial screens, terms, contracts, Pix/boleto/card flows, payouts, receipts, and patient billing as the provider responsible for contracted financial services.
- Supabase stores relational metadata, Auth, RLS, realtime, and Edge Functions. It is not the primary document store.
- Cloudflare R2 stores private document bytes. Supabase stores metadata and authorizes uploads/downloads through Edge Functions and short-lived signed URLs.
- Documents, notes attachments, AI chat files, portal patient files, and imported historical objects use R2 unless explicitly marked public and non-sensitive.
- Patient accounts and professional accounts are separate roles. Patients must land in `/portal`; professionals must not enter patient portal without an explicit patient relationship.
- Clinic and multi-professional product surfaces are currently outside the active product scope.
- **NeuroVision** is the public/product name of the graph visualization previously presented as NeuroView. Legacy identifiers such as `neuroview`, `NeuroView.tsx`, storage keys, media keys, database objects, and Synapse destinations may remain until a dedicated compatibility migration is executed; they must not be renamed casually because they are technical contracts.
- **NeuroTime** is a desktop presentation inside the same clinical knowledge surface as NeuroVision. It is not a separate diagnostic engine and must not infer clinical risk on its own.

## Psychologist Desktop Product Surfaces

| Surface | Desktop contract |
| --- | --- |
| Dashboard | Operational starting point for agenda, patients, pending work, Synapse, and clinic status. |
| Agenda | Daily/monthly scheduling and appointment operations connected to patient context. |
| Patients / Prontuário | Patient record, history, goals, documents, summaries, and continuity of care. |
| Notes / NeuroBox | Professional knowledge workspace containing notes, tasks, files, Notion integration, NeuroVision, NeuroTime, NeuroFlow, and NeuroPulse. |
| NeuroVision | 2D/3D visual representation of clinical connections and evidence. The current implementation lives behind legacy `neuroview` technical identifiers. |
| NeuroTime | Temporal view of the same clinical evidence, presented as a **Horizonte de eventos** and **Campo temporal**. |
| NeuroFlow | Visual flow/canvas for connected clinical reasoning and next steps. |
| NeuroPulse | Synthesis/processing surface for relevant clinical signals and structured outputs. |
| NeuroFinance | Financial account and payment operations connected to the professional workflow, with Asaas attribution. |
| Synapse | Text/voice agent that reads authorized context and prepares or executes governed product actions. |

### NeuroTime data contract

NeuroTime currently organizes events coming from the following desktop evidence sources:

- prontuário and its sub-areas;
- NeuroFlow;
- reviewed AI summaries;
- mood diary;
- agenda;
- finance;
- reminders.

The desktop implementation supports period/source/patient filtering and groups events into temporal singularities. Any risk marker displayed by NeuroTime must originate from a value already registered or explicitly overridden by the professional; the temporal model must not manufacture a clinical-risk classification.

Primary implementation references:

- `src/components/notes/NeuroView.tsx` — active NeuroVision/NeuroTime presentation host;
- `src/components/notes/desktop/neurovision/*` — NeuroVision desktop controls/presentation switching;
- `src/components/notes/desktop/neurotime/*` — NeuroTime desktop UI;
- `src/components/notes/clinical-evidence/neurotime-*` — NeuroTime evidence adapter/model/types.

## Active Route Families

| Family | Route examples | Status |
| --- | --- | --- |
| Auth | `/auth`, `/reset-password`, `/email-confirmed` | Active |
| Professional desktop app | `/dashboard`, `/agenda`, `/pacientes`, `/notas`, `/financeiro/*`, `/ajustes`, `/teleconsulta` | Active and canonical |
| Patient portal | `/portal/*`, `/portal/convite/:token`, `/portal/ativar` | Active, separate patient surface |
| Public/semi-public workflows | `/confirmar-agendamento/:token`, `/join/:appointmentId`, `/payment/callback`, `/anamnese-externa/:id`, `/help` | Active |
| NeuroZap | `/neurozap` | Desktop Beta / availability-controlled |
| Hidden evaluation | `/teleconsulta-antiga`, `/notas-mobile-antiga` | Pending dedicated product review; not architecture source of truth |

## Public Desktop Contract

The public desktop landing is composed from `src/pages/desktop/DesktopIndex.tsx`.

- Public product naming must use **NeuroVision**, not NeuroView.
- Legacy `neuroview` media/catalog keys may continue to back NeuroVision screenshots until the asset catalog itself is migrated.
- **NeuroTime is exposed publicly only on `/neurobox`**, alongside NeuroVision, NeuroFlow, and NeuroPulse. It must not appear as a dedicated section on the public home or in the public plan catalog unless product scope changes explicitly.
- On `/neurobox`, NeuroTime must be described using behavior already present in the psychologist desktop: temporal organization of evidence, source/period/patient filtering, and professional-controlled risk records.
- Public copy must not promote NeuroTime, NeuroVision, Synapse, or other AI-assisted surfaces as autonomous diagnosis or clinical decision-makers.

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