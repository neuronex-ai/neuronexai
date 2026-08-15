# Import Map

This file defines the intended shape of the next import step. **No current frontend files are copied yet.**

## Proposed structure

```text
neuronext/
├── README.md
├── DESIGN_CONTEXT.md
├── IMPORT_MAP.md
├── SCOPE.md
├── app/
│   ├── routes/
│   └── providers/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── navigation/
│   ├── dashboard/
│   ├── agenda/
│   ├── patients/
│   ├── notes/
│   ├── financeiro/
│   ├── teleconsulta/
│   ├── ajustes/
│   ├── neurozap/
│   └── synapse-pill/
├── pages/
│   ├── dashboard/
│   ├── agenda/
│   ├── patients/
│   ├── notes/
│   ├── financeiro/
│   ├── teleconsulta/
│   ├── ajustes/
│   └── neurozap/
├── mock/
│   ├── profile/
│   ├── patients/
│   ├── appointments/
│   ├── notes/
│   ├── finance/
│   ├── notifications/
│   └── synapse/
├── styles/
└── assets/
```

## Import rule

The next pass should follow component dependencies outward from each Desktop surface rather than blindly copying the entire repository.

For each imported area:

1. identify the current Desktop entry component;
2. identify its visual child components;
3. identify shared UI/layout dependencies;
4. identify backend/data hooks;
5. replace only the backend/data boundary with local mocks;
6. keep visual composition and interaction behavior faithful.

## Desktop surfaces in scope

- Dashboard
- Agenda
- Patients
- Patient detail
- Notes / NeuroBox
- Finance UI
- Teleconsultation UI
- Settings
- NeuroZap
- Synapse bottom-right text/voice pill

## Explicitly not imported

- `/synapse-ai` Desktop application
- production Supabase client/data layer
- production authentication/session behavior
- Edge Functions
- real financial integrations
- real WhatsApp integrations
- real teleconsultation infrastructure
- production credentials or secrets

## Important distinction

This structure is intentionally a **frontend container inside the existing repository**, not a new production application yet. It allows the first import to happen in a contained path while the rest of NeuroNex continues untouched.
