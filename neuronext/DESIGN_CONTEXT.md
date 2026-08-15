# NeuroNex Desktop — Test Design Context

## Visual objective

The first imported build in `neuronext/` must be a faithful visual and interaction reference of the current NeuroNex psychologist Desktop. Do not redesign during the import stage.

The Lab exists so that later interface experiments can be made without risking the live product.

## Theme

The Desktop supports two first-class appearances:

- **Dark:** the primary immersive/clinical workspace treatment, using the project's semantic dark tokens, glass/panel surfaces, borders, foreground hierarchy, and restrained accents.
- **Light:** a complete light counterpart using the same semantic token system rather than hard-coded colors.

Components should consume semantic design tokens such as:

- `bg-background`
- `text-foreground`
- `bg-card`
- `text-card-foreground`
- `border-border`
- `bg-muted`
- `text-muted-foreground`
- `bg-primary`
- `text-primary-foreground`

Do not introduce arbitrary one-off colors when an existing semantic token expresses the intended role.

## Desktop shell

Preserve the current composition and behavior of the Desktop shell:

`DesktopLumenBackdrop → Navbar → route transition → page/workspace`

The shell should remain stable while individual surfaces are tested.

## Navigation

The initial import should preserve the current Desktop navigation structure and active-route behavior. Navigation may use local routing in the Lab, but clicking a navigation item should lead to the corresponding imported surface just as it does in the current product.

## Interaction fidelity

Before redesign:

- buttons should remain clickable where they are clickable today;
- tabs should preserve their current selection behavior;
- dialogs/modals should open and close in the same conceptual places;
- filters, search, view switches, and local UI states should behave plausibly like the current product;
- destructive/real operations must be mocked locally;
- loading, empty, success, and error states should be represented locally where they are part of the existing experience.

## Synapse pill

Only the **bottom-right conversation pill/launcher** is included in this first Lab scope.

It should support the visual states and entry points for text and voice interaction that the current Desktop launcher presents. The full `/synapse-ai` Desktop page is explicitly excluded because it contains legacy specific to that surface.

## What not to do during import

- Do not redesign a page.
- Do not improve spacing merely because a different value looks better.
- Do not replace the current navigation model.
- Do not invent new product behavior.
- Do not connect to production data.
- Do not silently carry production backend dependencies into the Lab.

First make the Lab recognizable as the current NeuroNex Desktop. Then experiment.
