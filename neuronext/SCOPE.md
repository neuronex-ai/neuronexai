# Scope

## Phase 0 — Structure only

This commit intentionally contains **no imported frontend source files**.

It establishes the isolated `neuronext/` workspace and its rules so the next import can be performed deliberately.

## Phase 1 — Faithful frontend import

Import the current psychologist Desktop UI into this directory, including the shared visual components it actually depends on. Convert backend/data calls to local mock boundaries as necessary.

Success criterion: a user should recognize the Lab as the current NeuroNex Desktop before any redesign occurs.

## Phase 2 — Interface experiments

After Phase 1 is validated, new layouts, navigation ideas, redesigned tabs, component replacements, and other UX experiments may be made freely inside the Lab.

## Phase 3 — Selective promotion

When an experiment is approved, its frontend changes can be manually ported to the production application and reconnected to the existing production backend. Nothing in this Lab is automatically considered production-ready.

## Safety

The real NeuroNex application, its Supabase project, real users, real financial operations, and existing integrations are outside the scope of this workspace.
