# Zeta Stitch Handoff

This folder turns the raw screenshot dump into a smaller design handoff for Stitch.

## Files

- `review.md` — product and showcase review
- `stitch-brief.md` — copy-paste prompt for Stitch
- `index.html` — static overview page
- `current-state-board.png` — compact board made from the most important current screens
- `inputs/` — per-screen paired references with desktop + mobile crops

## Recommended use in Stitch

1. Drag `current-state-board.png` into Stitch first.
2. Add one or more paired references from `inputs/` if you want extra detail on a specific flow.
3. Paste the prompt from `stitch-brief.md`.
4. Use `../ship-now/01-estado-y-siguiente-paso.html` as the direction to preserve.

## Why this format

The original showcase is useful as an archive, but weak as a redesign input:

- it treats all 18 screens as equally important
- it has extremely tall screenshots that are hard to scan
- it does not explain what should change versus what should stay

This package keeps the strongest screens visible while giving Stitch a clearer target.

## Stitch notes

Google’s official Stitch announcement says Stitch can generate UI from image inputs, including screenshots and wireframes, and later paste designs to Figma:

- https://developers.googleblog.com/stitch-a-new-way-to-design-uis/
- https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-gemini-3/
