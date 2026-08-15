# Import Map

`neuronext/` is now a real, standalone frontend workspace. The first slice imported is **Agenda**. The goal is to reproduce the Desktop surface and its local interactions before redesigning anything.

## Standalone runtime contract

From inside `neuronext/`:

```bash
npm install
npm run dev
```

The Vite server is pinned to `localhost:8080`. No production environment variables, Supabase project, backend, or real integrations are required for the current slice.

## Import pipeline

### 0 — Foundation
- [x] Standalone `package.json`
- [x] Vite entrypoint on port 8080
- [x] TypeScript configuration
- [x] Light/dark theme foundation
- [x] Desktop shell placeholder
- [x] Navbar/navigation shell
- [x] Bottom-right Synapse text/voice pill

### 1 — Agenda
- [x] Desktop Agenda page boundary
- [x] Day / Week / Month navigation
- [x] Date navigation and Today action
- [x] Appointment mock data
- [x] Appointment cards and status presentation
- [x] Online / presencial visual states
- [x] Local filtering interaction
- [x] Waitlist panel interaction
- [x] Appointment detail modal
- [x] New appointment modal
- [x] Local appointment creation
- [x] Local appointment status update
- [ ] Import remaining production Agenda visual subcomponents one-by-one where they add fidelity
- [ ] Import advanced reschedule/review/conflict dialogs
- [ ] Import Agenda settings/category/recurrence surfaces
- [ ] Import production drag-and-drop visual behavior after its backend boundary is isolated
- [ ] Compare the Lab visually against the current production Agenda and close fidelity gaps

### 2 — Notes / NeuroBox
- [ ] Notes shell
- [ ] Notes list/editor
- [ ] Tasks
- [ ] NeuroView structure first
- [ ] NeuroFlow structure first
- [ ] NeuroPulse structure first
- [ ] NeuroDrive/files structure
- [ ] Remaining large internal interactions after the structure is stable

### 3 — Patient directory
- [ ] Patient list
- [ ] Search/filter states
- [ ] New patient modal
- [ ] Patient row actions
- [ ] Empty/loading states

### 4 — Patient detail / prontuário
- [ ] Patient header
- [ ] Tabs
- [ ] Clinical/session surfaces
- [ ] Notes and related panels
- [ ] Local mock patient state

### 5 — Finance UI
- [ ] Finance shell/navigation
- [ ] Gestão Financeira surfaces
- [ ] NeuroFinance visual surfaces
- [ ] Account/statement/payment UI
- [ ] No real financial integration

### 6 — Teleconsulta UI
- [ ] Waiting/session states
- [ ] Video surface
- [ ] Controls
- [ ] Transcript/session UI
- [ ] No real teleconsultation infrastructure

### 7 — Settings
- [ ] Settings shell
- [ ] Profile/preferences UI
- [ ] Notification/settings surfaces
- [ ] Local-only persistence where useful

### 8 — NeuroZap
- [ ] Desktop surface
- [ ] Conversation/list panels
- [ ] Local interaction states

### Explicitly excluded

- [ ] `/synapse-ai` Desktop application — **do not import**
- [ ] Production Supabase client/data layer
- [ ] Production authentication/session behavior
- [ ] Edge Functions
- [ ] Real financial integrations
- [ ] Real WhatsApp integrations
- [ ] Real teleconsultation infrastructure
- [ ] Production credentials/secrets

Only the **bottom-right Synapse conversation pill/launcher for text and voice** is in scope.
