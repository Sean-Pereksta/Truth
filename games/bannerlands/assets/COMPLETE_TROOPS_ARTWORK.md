# Painted troop animation rollout

Troop figures must be image-generated painted PNG artwork. Every source frame
contains the complete character, hands, equipment and weapon. The renderer
selects and draws that source frame; it does not construct a soldier from shapes
or add replacement weapons, limbs, shields, reload devices or attack strokes.

This is an unfinished, staged rollout. A direction reference sheet is not a
completed animated troop. Full character movement and action cycles are the
deliverable. Existing generated PNGs remain in use for troops outside the active
painted atlas batch. New static design baselines, including the Martell javelin
reference, are explicitly reference-only until proper animation sets are ready.

## Required coverage

Every troop in `UNIT_DEFS`, including siege, giants and commanders, needs at
least eight authored directions. Foot pikes, spears and halberds whose direction
governs interception need sixteen. Lannister/Targaryen shield bearers,
Mormont/Martell/Arryn lance champions and the king are tracked as separate
variants. Mirrored copies do not create additional authored directions.

For each direction, walking and backward walking require at least four real
phases, preferably eight. Attacks need a real windup/draw, release or contact,
and recovery. Hit reactions require at least two phases; death requires at least
four. Applicable reload, support and other special actions require at least
four phases. A held pose may have fewer frames, but cannot replace a movement,
turn, loading or death animation. Body and gear must animate together.

Heavy pikes must remain approximately 2.5–3 standing body heights long. Sprite
bounds expand around the full weapon instead of shrinking the wielder.
Proportion, actual grip, front/rear visibility and release-point alignment need
visual verification in motion, not just a count of sprite cells.

## Runtime data

`painted-troops/manifest.json` names the actual generated PNGs, explicit source
rectangles, per-frame foot anchors, measured human body heights and animation
clips. `../complete-troops.js` only selects these PNG rectangles. It contains no
character drawing code. A source frame is scaled by its human body height,
preserving the complete weapon. The selected unit and its portrait use the same
painted source artwork. No lower graphics setting invents equipment.

Generated pages are authoring sources. Mechanical packing copies their painted
frames into compact per-troop runtime atlases using the same action/direction/
phase schema across the roster. Runtime loading does not depend on a large
fixed number of authoring files for every troop. Each troop's original design
and all parts of each complete painted frame survive packing unchanged.

Each `clips[action][direction][phase]` entry points to a sheet and cell or an
explicit `rect`. `anchorPixels` describes the foot anchor inside that rectangle.
Multiple house variants can coexist as keys such as `lance_champion:bear`, with
`type: "lance_champion"` and `house: "bear"`.

The simulation supplies direction, loading stage, loaded/cocked/seated-bolt
state and release timing. Optional painted carry variants distinguish an empty
weapon, a spanned empty weapon and a weapon with a seated bolt. Missing artwork
is recorded as a gap; the renderer never draws a missing mechanism over a unit.

During this draft rollout, an explicit `fallbackAction: "ready"` can keep a new
pikeman visible when an action is unfinished. That complete painted frame is
marked `draftFallback`, with its `requestedAction` retained. It does not count
as finished bracing, loading, movement or death artwork. New pikemen never fall
back to old shield-bearing troop art. `referenceOnly: true` excludes a static
reference sheet from gameplay activation.

## Review and audit

`source/process-painted-atlas.mjs` and `source/assemble-painted-rollout.mjs`
inspect and map native painted pixels, transparent gutters and anchors. They
do not author body or equipment pixels. Some PNG viewers display RGB colors in
nearly transparent pixels incorrectly; inspect alpha values and an opaque
preview composite before judging a backdrop. A preview composite is not a
replacement source asset.

Run these commands from the Bannerlands directory with `@napi-rs/canvas`
available (or set `LANDS_CANVAS_MODULE`):

```
node source/author-troops.mjs path/to/painted-review
node source/audit-troop-art.mjs
```

The first command delegates to the actual PNG review tool. The second writes
`painted-troops/coverage.json` for all 34 unit types and 38 current variants.
The audit distinguishes declared directions, unique source phases, visually
verified phases and directions, temporary aliases/fallbacks, alpha approval and
weapon proportions. No target is complete until its full required animation
set passes those checks. Ready-only references cannot satisfy walking or action
coverage. Open source-quality issues are retained in `coverage-notes.json`.
Motion previews are required alongside contact sheets to inspect actual gait,
loading work and falls at gameplay scale. Use `npm run audit:troops` to refresh
the report and `npm run test:coverage` to check the roster and phase rules.

Exact generation prompts and built-in image-generation provenance for the
Bridge Warden, Dread Pike, Crannog Spearhand and Martell reference work are in
`painted-troops/raw/generation-prompts-artwork.json`.
The main redesign and animation batch is recorded in
`painted-troops/generation-prompts-root.json`, with the exact prompt text and
source mappings in `painted-troops/prompts/`. These assets were made with the
built-in image-generation tool; no CLI/API fallback or shape-drawn troop
substitutes were used for the painted source artwork.
