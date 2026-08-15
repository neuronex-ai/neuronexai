# NeuroNex Desktop Frontend Lab

## Purpose

`neuronext/` is an isolated workspace inside the NeuroNex repository for rebuilding and experimenting with the **psychologist Desktop interface** without changing the production frontend, backend, Supabase project, or real integrations.

This is a **frontend-first test area**. The first imported version must reproduce the current Desktop experience faithfully before any redesign work begins.

## Safety boundary

- Do not import or reference the production Supabase project from this workspace.
- Do not import production credentials, secrets, service-role keys, Asaas credentials, WhatsApp credentials, realtime channels, Edge Functions, webhooks, or other production integrations.
- Do not modify production backend behavior as part of work in `neuronext/`.
- Real financial transactions and real psychologist/patient data must never be used here.
- Initially, backend-dependent behavior should be represented by local mocks/stubs only.

## Current scope

The initial scope is the **Desktop interface for the psychologist**, including its visual shell, navigation, tabs, panels, dialogs, local interaction states, light/dark themes, and the existing Desktop surfaces.

### Included in the initial import

- Desktop shell and layout
- Navbar and navigation behavior
- Light and dark appearance
- Dashboard
- Agenda
- Patients and patient detail
- Notes / NeuroBox surfaces
- Finance UI (visual/interaction layer only)
- Teleconsultation UI (visual/interaction layer only)
- Settings UI
- NeuroZap UI
- Shared visual components required by the above
- The small Synapse conversation pill/launcher shown at the bottom-right of the Desktop, for text and voice interaction

### Explicitly excluded for now

The existing `/synapse-ai` Desktop application is **not** part of this import. Its current Desktop implementation contains its own legacy and should not be brought into `neuronext/` at this stage.

Only the bottom-right Synapse conversation pill/launcher is in scope.

## Workflow

1. Create the frontend skeleton here.
2. Import/adapt the current Desktop frontend into this isolated area.
3. Replace backend/data dependencies with mocks without changing the intended UI behavior.
4. Validate that the Lab faithfully reproduces the current Desktop.
5. Only after fidelity is established, experiment with new UX and visual ideas.
6. Approved improvements may later be ported back into the production application deliberately.

The production application remains the operational source of truth. This directory is an experimentation surface, not a replacement for it.
