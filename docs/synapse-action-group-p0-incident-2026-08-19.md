# Synapse action-group P0 — 2026-08-19

## User-visible failure

A voice request for a multi-action package was understood conversationally, but no horizontal review cards appeared and no group action executed.

## Evidence from the Sandbox

Voice session `23245dc3-64c9-4f4b-a63a-70e545f1baa1` / conversation `1ef20b7a-54da-44b9-b484-1a80da4018ee` reached the current voice stack and produced successful read tool calls, but `synapse_composite_action_plans` contained no row for the conversation. Matching `synapse-voice-tool` v77 requests returned HTTP 500 during group preparation.

The requested package mixed executable results with a read-only request (verify the patient's next session). The action-group builder treated any read tool inside `steps` as a fatal error, so the plan failed before persistence and before `review_action` could be emitted.

## P0 corrections

- read-only steps accidentally supplied inside the raw package are treated as preflight/context and omitted from the executable timeline instead of aborting the group;
- executable steps are renumbered after preflight filtering and dependency references survive the filtering;
- once `prepare_action_group` is selected, every normal group opens a versioned review instead of silently executing when fewer than five executable cards remain;
- critical/NeuroFinance groups retain opaque confirmation;
- the planner's `tool_name` schema is constrained to canonical voice-allowed executable/interface tools, preventing read tools such as `get_calendar` from becoming cards;
- Agenda editable fields use the current canonical `datetime` / `new_datetime` arguments;
- the protected browser challenge now follows the requested 1–999 range and accepts one, two or three spoken/typed digits;
- voice guidance now proactively proposes concrete reviewed packages from real context and treats short acceptance phrases as permission to prepare, not execute, the reviewed plan.

## Review handoff audit

The Desktop path is present: the voice hook consumes `review_action`, while the global live-voice client-action handler recognizes `synapse_action_review`, emits the shared review event and ACKs the gateway. `SynapseVoiceActionOverlays` is mounted globally inside the operational application providers. Therefore the review becomes visible once the backend successfully persists and returns the action-group review.

## Deployment note

GitHub Actions validates the Stage 3/4 voice runtime but currently has no `SUPABASE_ACCESS_TOKEN`, so Sandbox deployment is skipped. The updated branch must be pulled and `synapse-voice-tool`, `synapse-voice-agent-session` and `synapse-voice-gateway` deployed manually for an interface test to exercise this fix.
