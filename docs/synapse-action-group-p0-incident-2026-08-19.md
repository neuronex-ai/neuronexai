# Synapse action-group P0 — 2026-08-19

## User-visible failure

Voice requests for reviewed multi-action packages were understood conversationally, but horizontal review cards did not appear and no group action executed reliably.

## First reproduced failure

Voice session `23245dc3-64c9-4f4b-a63a-70e545f1baa1` / conversation `1ef20b7a-54da-44b9-b484-1a80da4018ee` reached the voice stack and produced successful read calls, but no row was created in `synapse_composite_action_plans`. Matching `synapse-voice-tool` v77 requests returned HTTP 500 during group preparation.

The requested package mixed executable results with a read-only request (verify the patient's next session). The builder treated a read tool inside `steps` as fatal, so the plan failed before persistence and before `review_action` could be emitted.

## Second reproduced failure — empty nested arguments

After the preflight fix was deployed, voice session `cf6999cf-aeb1-4789-9cf6-78b6362613c1` / conversation `751ed538-3e89-4756-a3bf-49e55b2c9e78` exposed a deeper routing/schema problem.

The professional explicitly asked for a reviewed group. Instead of using `prepare_action_group`, the model invoked `create_session_note`, `create_financial_entry`, `send_patient_email` and patient snapshot calls separately. `synapse_action_logs` shows these calls arrived with `arguments: {}` / `resolvedArgs: {}`. This caused `patient_name_required` even after the professional explicitly said `Carlos` and later `Josué Silveira`; the empty financial call also produced `Valor financeiro inválido`.

A subsequent `list_patients` succeeded with six records and included both Carlos and Josué Silveira, proving that the patient failures were argument propagation failures rather than missing patient records.

The durable conversation state at the end of this session contained only `lastTool=list_patients`; no active patient had ever been established because every earlier patient-scoped call arrived empty. This created a circular failure: the resolver could use durable patient context only after a successful patient-aware call, but the model was failing to send the patient argument needed to create that context.

When the assistant then offered to assemble the Josué package and the professional answered `Eu quero, pode fazer`, `synapse-voice-tool` v79 returned HTTP 500 at 2026-08-19T19:31:04Z before any review plan was persisted. The assistant consequently emitted the vague `não recebi um retorno confiável` fallback.

## P0 corrections

- read-only steps inside a raw package are treated as preflight/context and omitted from the executable timeline instead of aborting the group;
- executable steps are renumbered after preflight filtering and dependency references survive the filtering;
- every explicit `prepare_action_group` opens a versioned review;
- critical/NeuroFinance groups retain opaque confirmation;
- action-group `tool_name` is constrained to canonical voice-allowed executable/interface tools;
- voice toolset v10 removes generic operational mutations from `execute_synapse_tool`; note creation, financial entries, email, Agenda mutations and similar effects must now pass through `prepare_action_group`;
- NeuroFlow/NeuroPulse remain delegated only as explicit named-product exceptions;
- `prepare_action_group.steps[].arguments` is required and exposes canonical argument fields from the real executable tool schemas;
- direct patient-centered read tools require `patient_name` explicitly in the Deepgram schema;
- the action-group builder deterministically recovers the most recent explicit patient mention from user-authored conversation messages when a planned patient-scoped step still omits `patient_name`; matching is against real patients owned by the account, with first-name fallback only when unique;
- the builder can recover an explicitly spoken recent monetary amount, including forms such as `R$ 150`, `150 reais` and `cento e cinquenta reais`, for a financial card whose model arguments omitted the amount;
- patient and amount recovery only reuses explicit professional speech / durable context; it does not generate clinical note content or email bodies;
- voice guidance no longer instructs the assistant to say `não recebi um retorno confiável` when a concrete tool error exists;
- voice guidance forbids falling back to executing mutating steps one-by-one when planner preparation fails;
- Agenda editable fields use canonical `datetime` / `new_datetime` arguments;
- protected browser challenge follows the requested 1–999 range and accepts one, two or three spoken/typed digits.

## Review handoff audit

The Desktop path is present: the voice hook consumes `review_action`, while the global live-voice client-action handler recognizes `synapse_action_review`, emits the shared review event and ACKs the gateway. `SynapseVoiceActionOverlays` is mounted globally inside the operational application providers. Therefore the review becomes visible once the backend successfully persists and returns the action-group review.

## Verification

Regression coverage locks v10 mutation routing, planner canonical argument exposure, direct patient-name requirements, read-preflight filtering and conversation fact recovery. The toolset regression also guards against uncontrolled settings-size growth. GitHub Actions type-checks `synapse-voice-tool`, `synapse-voice-agent-session` and `synapse-voice-gateway` before any optional deployment.

## Deployment note

GitHub Actions has no `SUPABASE_ACCESS_TOKEN`, so Sandbox deployment is skipped after successful type-check. `synapse-voice-tool` and `synapse-voice-agent-session` must be deployed manually from the current branch before the next interface test. `synapse-voice-gateway` was not changed by the v10 routing/fallback patch.
