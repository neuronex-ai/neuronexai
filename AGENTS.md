## Apple HIG Refactor Mode

When asked to refactor UI, layout, components, interactions, or animations, use Apple's Human Interface Guidelines as the primary design source.

Only use these HIG areas:
- Foundations: layout, color, typography, motion, materials, accessibility, SF Symbols, writing.
- Behaviors: motion, gestures, feedback, navigation behavior, presentation behavior, input behavior.
- Components: system-defined controls, navigation, search, presentation, selection/input, status, lists, menus, toolbars, sheets, text fields.

Workflow:
1. Inspect the current screen/component implementation.
2. Identify custom UI that should become native platform components.
3. Map each screen element to the closest Apple HIG component or foundation rule.
4. Refactor using native platform primitives first.
5. Avoid decorative custom animations unless they clarify state, direction, cause, or feedback.
6. Use motion only when it reinforces spatial continuity, gesture response, task feedback, or state change.
7. Preserve accessibility: Dynamic Type, semantic colors, sufficient contrast, VoiceOver labels, reduced motion support, safe areas, and touch targets.
8. In the final summary, include:
   - changed components
   - HIG sections consulted
   - custom UI replaced with native UI
   - animation/behavior changes
   - remaining HIG risks

Links for Search:
- https://developer.apple.com/design/human-interface-guidelines/

<!-- context7 -->

Use Context7 MCP to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service — even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer — your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

## Steps

1. Always start with `resolve-library-id` using the library name and the user's question, unless the user provides an exact library ID in `/org/project` format
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question). Use version-specific IDs when the user mentions a version
3. `query-docs` with the selected library ID and the user's full question (not single words), scoped to a single concept. If the question spans multiple distinct concepts (e.g. routing and auth and caching), make a separate `query-docs` call per concept with the same library ID, unless the question is about how the concepts interact — combined queries dilute ranking and return shallow results for each topic
4. Answer using the fetched docs
<!-- context7 -->

## NeuroNex surface boundaries

Keep four frontend surfaces explicit in every change:

- **Public:** landing, help, pricing, contact, legal, authentication, and workflows opened through external links. It may have separate desktop/tablet and mobile presentations.
- **Professional desktop:** the current product for psychologists on desktop and tablet. `src/pages/desktop` contains part of it.
- **Professional mobile:** the future mobile-first product. New mobile work belongs in `src/apps/professional-mobile`; `src/mobile` is transitional code currently in use, not the future product specification.
- **Patient portal:** the patient-facing application under `/portal`. It is not part of the professional mobile product.

Rules for agents:

1. Files directly under `src/pages` may act as route adapters: they can select and lazy-load a surface, but should not contain a complete shared desktop/mobile workspace.
2. Desktop must not import mobile views. Mobile must not import desktop pages, shells, layouts, forms, modals, or operational view components. Public and patient-portal screens must not import professional interfaces.
3. Surfaces may share non-visual behavior: domain rules, data hooks, services, validation, types, authentication, Supabase access, and deliberately neutral primitives from `src/components/ui`.
4. A file under `src/components` is not automatically safe to share. Evaluate whether it contains platform-specific layout or interaction.
5. Below 768px currently selects mobile; 768px and above selects desktop/tablet. Do not create different business rules based on screen size.
6. The current mobile version is not a mandatory visual or structural reference. Rebuild mobile-first later without copying the desktop UI.
7. **NeuroZap is a planned Desktop Beta surface composed of its route, page, hooks, Edge Functions, database references, realtime behavior, and Synapse links.**
8. Reorganize one functional area at a time and keep every active surface working.

See `docs/FRONTEND_SURFACES.md` for the current map and migration direction.

## NeuroNex quality bar

An area is not complete merely because its primary path renders. Apply the full completion criteria in `docs/QUALITY_BAR.md`, including interaction states, light/dark visual review, keyboard and focus behavior, reduced motion, stable textures, loading fluency, lint, typecheck, tests, build, and relevant public-page SEO checks.
