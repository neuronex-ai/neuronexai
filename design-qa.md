# Design QA — Next schedule card

## Comparison target

- Source visual truth:
  - `C:\Users\Nathalia\Pictures\Screenshots\Captura de tela 2026-08-25 134552.png` — collapsed reference, 574 × 466 px.
  - `C:\Users\Nathalia\Pictures\Screenshots\Captura de tela 2026-08-25 134557.png` — expanded reference, 706 × 558 px.
- Browser-rendered implementation:
  - `docs/design-qa/next-schedule-card/implementation-dark-collapsed.png` — 426 × 298 px.
  - `docs/design-qa/next-schedule-card/implementation-dark-expanded.png` — 426 × 484 px.
  - `docs/design-qa/next-schedule-card/implementation-light-collapsed.png` — 426 × 298 px.
- Combined comparison evidence:
  - `docs/design-qa/next-schedule-card/comparison-collapsed.png` — 987 × 390 px.
  - `docs/design-qa/next-schedule-card/comparison-expanded.png` — 1036 × 540 px.
- Browser viewport: 1280 × 720 CSS px at device pixel ratio 1.25.
- Component CSS size: 358 × 228 px collapsed and 358 × 408 px expanded, inside a 390 px-wide dashboard column.
- Capture normalization: implementation clips include 18 CSS px of context around the 390 px panel. Source card regions were cropped from the standalone template and both sides were scaled to the same comparison height (300 px collapsed; 450 px expanded). The reference and implementation intentionally have different frame widths because the implementation is constrained to the existing dashboard's right column.
- State: recurring online clinical session, occurrence 5/6, confirmed, R$ 220 pending; dark collapsed, dark expanded, and light collapsed.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Intentional adaptation: the reference's decorative location-map reveal was replaced by a clinical schedule reveal. The implementation preserves the compact-to-expanded structure, rounded monochrome material, status affordance, and in-place motion, while the expanded state exposes recurrence, finance, confirmation, room, last-session context, and preparation actions.
- Typography: the source's compact uppercase eyebrow and large focal value are preserved. Supporting labels use the app font stack and stronger optical weights; the smallest expanded labels and actions were increased during QA for legibility.
- Spacing and layout rhythm: the implementation uses the right-column width, 16 px internal staging, 28 px card radius, 22 px detail radius, and 44 px action targets. No clipping or horizontal overflow is visible in either state.
- Colors and tokens: both themes remain monochrome. Light mode uses ceramic surfaces with dark text; dark mode uses onyx layers with zinc borders. Status meaning is carried by copy and icons, not color alone.
- Image and asset fidelity: no raster artwork is required in the adapted clinical card. All visible controls use the project's Lucide icon system; the source map asset was intentionally omitted because it no longer represents the product task.
- Copy and content: all visible text is specific to the psychologist workflow. No template copy such as “Current location”, coordinates, or “Live” remains.

## Focused comparison

No smaller focused crop was needed: each combined comparison isolates the complete card at a scale where the eyebrow, focal time, patient, recurrence, financial details, and CTAs are readable. The separate light capture was reviewed to verify foreground/background balance.

## Interaction and runtime evidence

- Expand and collapse were exercised in the in-app browser; `aria-expanded` and `aria-controls` expose the state relationship.
- The expanded state exposes the share affordance and both primary preparation actions without overflow.
- A fresh browser tab reported no console warnings or errors.
- Reduced-motion behavior is implemented through `useReducedMotion`; hit targets for share and CTAs are 44 px high/wide.

## Comparison history

1. Pass 1: no P0/P1/P2 mismatch. A P3 legibility refinement was identified in 9–10 px auxiliary labels and CTA text.
2. Fix: expanded detail labels and summary tags were raised to 10 px, and CTAs to 12 px; the dark expanded state was recaptured.
3. Pass 2: the revised combined comparison shows the denser type remains readable and the card still fits the 358 px content width. No actionable P0/P1/P2 findings remain.

## Open questions and residual gaps

- The browser evidence uses the recurring online-session state. One-off in-person sessions, general events, agenda blocks, empty, and loading states are covered by component/model branches and targeted tests, but were not all captured as separate screenshots.
- The authenticated production dashboard could not be captured in the isolated browser session, so the implementation was rendered in a component harness using the production component and dashboard styles at the exact right-column width.

## Implementation checklist

- [x] Preserve the reference's compact/expanded interaction model.
- [x] Replace map content with useful clinical and operational context.
- [x] Verify light and dark monochrome materials.
- [x] Verify keyboard semantics, focus styling, reduced motion, and 44 px controls.
- [x] Recompare after typography refinement.

## Follow-up polish

- P3: capture the remaining appointment categories with authenticated production data if a future visual-regression suite is added.

final result: passed
