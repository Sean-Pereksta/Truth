# Painted dungeon floors and scenery

Eight original images generated on 2026-10-29 with OpenAI’s built-in image generation tool. Exact prompts and generation IDs are in `scenery-prompts.json`. The four prop sheets use the existing game scenery sheet as a style reference; floor textures were generated from their original descriptions. No third-party artwork was copied.

| Theme | Opaque floor | Transparent props | Prop sheet dimensions |
| --- | --- | --- | --- |
| Rimeglass Reservoir | rimeglass-floor.png | rimeglass-props.png | 1536 × 1024 |
| Cindercoil Foundry | cindercoil-floor.png | cindercoil-props.png | 1774 × 887 |
| Zephyr Sanctuary | zephyr-floor.png | zephyr-props.png | 1536 × 1024 |
| Drowned Maw | drowned-maw-floor.png | drowned-maw-props.png | 1536 × 1024 |

All floor sources are 1254 × 1254. They depict textured ice over slate, soot-stained iron/basalt, ivory wind-carved stone, and wet shell-carved temple paving respectively. The renderer repeats them beneath the actual walkable floor geometry. Decorative scenery does not change collision, key locks, gate rules or route visibility.

Each prop sheet contains eight separate objects in this order: support/pillar, major machine or altar, natural terrain cluster, wall segment, lamp/beacon, supplies/debris, open doorway arch, and low mechanism/emblem. These are detailed bitmap scenery, not placeholder shapes. Rimeglass includes ice crystals and lake pumps; Cindercoil includes furnaces and steam valves; Zephyr includes bells and sanctuary stonework; Drowned Maw includes coral, pearl-shell ruins and tide anchors.

Source PNG pixels are unchanged. `tools/measure-dungeon-scenery.cjs` identifies the eight largest opaque connected objects per sheet and measures actual source rectangles and floor anchors. Its outputs are `scenery-frames.json` and `data/dungeon-scenery-art.js`. Actual prop spacing is nonuniform, so the runtime uses these measured rectangles instead of splitting the sheets into equal cells.

RGBA decoding verifies clear-alpha fractions of 49.82% for Rimeglass, 56.70% for Cindercoil, 54.68% for Zephyr and 50.16% for Drowned Maw. Colored gradients visible in some source viewers are hidden RGB beneath zero-alpha pixels; native Canvas composites the props transparently. No code-based background removal or raster modification was applied.

All four themes were rendered through the actual dungeon scenery renderer and visually inspected. Seven scenery checks pass, covering real asset alpha/bounds, floor/wall/prop drawing, clear opened gates and unchanged authored gameplay geometry. The additional modular wall atlas and Kraken attack effects have their own provenance supplied with those assets.
