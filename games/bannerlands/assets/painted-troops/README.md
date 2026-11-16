# Painted troop artwork: production pages and game atlases

`runtime/` contains the compact PNG atlases actually loaded by the game.
The current draft batch uses **one atlas per troop**, rather than loading a
separate image for every action or direction. The packer permits a second atlas
only if a troop would exceed its 1024 × 2048 page limit.

The larger PNGs beside this file are original image-generated production pages,
including action sequences and directional corrections. They are retained as
editable source artwork and provenance. `raw/` contains earlier review
candidates; those files do not automatically become active game sprites.

`manifest.json` maps each animation phase to a complete painted frame in a game
atlas. Its `sourcePaintedFrame` records retain the original production PNG,
crop, body scale and foot anchor for every packed frame. No limbs, weapons or
figures are drawn or added by the packer. It only crops, resamples and arranges
existing painted pixels, retaining two pixels of atlas padding.

Rebuild from `games/bannerlands` with the raster dependency available through
`LANDS_CANVAS_MODULE`:

```
node source/assemble-painted-rollout.mjs
node source/optimize-painted-runtime.mjs
node source/tests/painted-rollout.mjs
node source/preview-painted-animation.mjs river_ranger path/to/preview.gif
```

The first command rebuilds the native source mappings. The second normalizes
runtime body resolution to 80 source pixels, packs complete frames and updates
all crop rectangles and anchors together. The human body remains 31 world pixels;
long weapons never determine the scale of their bearer.

These assets remain **animation drafts**. The roster audit and
`docs/Sprite-Production-Plan.md` record missing phases, directions and physical
alignment checks. A painted still used temporarily for a missing action is an
explicit draft fallback, not a completed animation. Frey's remaining loading
page is pending after image-generation rejection. Polearm proportions and
sixteen-direction coverage are also unfinished.

The Ranger establishes the first animation draft: eight walking phases and
four shooting/falling phases in each of eight views. Turning, aiming and
recovery still need additional phases. An actual combat scene must verify the
painted bow's release point against the projectile origin before approval.
