# Painted dungeon walls

`dungeon-walls.png` is original transparent artwork generated on 29 October 2026 with OpenAI’s built-in image generation tool. The source file is `exec-05e733a1-6ed6-490e-95cf-4ff4eb43a4bc.png`. No third-party game artwork was used. The selected PNG is copied byte-for-byte; no pixel editing, resizing, background removal or alpha modification was performed.

The 1774 × 887 atlas contains four columns and two rows. Long walls and compact corners use different column widths; do not split it into equal cells. `dungeon-walls.frames.json` and `data/dungeon-wall-art.js` record explicit crops, opaque cores and floor anchors. Horizontal wall anchors sit at the center of the lower grounded edge. Corner anchors follow the weighted opaque foot position.

| Frame | Theme | Piece |
| --- | --- | --- |
| 0 | Rimeglass | Long ice-covered stone wall |
| 1 | Rimeglass | Icy corner stones |
| 2 | Cindercoil | Long copper-banded obsidian wall |
| 3 | Cindercoil | Copper and obsidian corner |
| 4 | Zephyr | Long mossy ruined wall |
| 5 | Zephyr | Moss-covered corner stones |
| 6 | Drowned Maw | Long wet barnacled seawall |
| 7 | Drowned Maw | Coral and barnacle corner stones |

Measurements use the existing read-only `decodePNG` and `measureFrame` helpers in `tools/build-art-atlas.cjs`, with column boundaries `[0, 610, 885, 1475, 1774]` and row boundaries `[0, 445, 887]`. All eight cell edges have zero pixels at alpha 16 or above. The original source has 963,703 fully transparent pixels. Visual inspection confirmed complete, separated silhouettes, consistent lighting and the requested material identities. The presentation copy is `outputs/previews/Dungeon-Wall-Art.png` in the containing delivery workspace.

The dungeon renderer uses these pieces outside the exposed floor union. The painted walls do not add collision, close doors or cover the playable floor. Existing floor and mechanism geometry remains authoritative.

## Generation prompt

Use case: stylized-concept. Asset type: original transparent PNG dungeon wall sprite atlas for a top-down painted fantasy action RPG, landscape 2:1 canvas. Exactly EIGHT isolated environment sprites arranged in a precise FOUR-column TWO-row grid; each sprite wholly inside its own equal-sized cell, centered, with generous truly transparent gutters at every cell boundary and outer edge. No labels, no text, no grid lines, no characters, no floor tiles, no room scenes, no background. Style: polished hand-painted storybook game art, chunky readable masonry forms, detailed natural material brushwork, restrained highlights, overhead three-quarter view with visible top surfaces and shallow front faces, consistent soft upper-left lighting. All long wall segments run perfectly horizontally left to right, not diagonally, approximately three times wider than tall, with continuous rugged top caps and clean grounded bottom silhouettes; all corner/boulder pieces are compact isolated groups of two or three matching stones forming a short corner. The eight sprites in row-major order MUST be: top row column 1 Rimeglass long low stone wall capped with pale blue ice and hanging icicles; top row column 2 Rimeglass compact icy stone corner/boulder chunk; top row column 3 Cindercoil long obsidian masonry wall with weathered copper pipe brackets and ember-warm seams, no fire spill; top row column 4 Cindercoil compact obsidian and copper masonry corner; bottom row column 1 Zephyr long windworn ruined stone wall with mossy green caps and a few fine fern details; bottom row column 2 Zephyr compact mossy ruin corner/boulder chunk; bottom row column 3 Drowned Maw long wet dark teal seawall covered with small pale barnacles, coral and shell traces; bottom row column 4 Drowned Maw compact wet coral-and-barnacle stone corner. Strong distinguishable silhouettes, fully drawn complete ends, no fragment or glow crosses a cell boundary. Transparent background with real alpha, not checkerboard artwork; retain all delicate icicle/fern edges. These are reusable original wall components, not a screenshot.
