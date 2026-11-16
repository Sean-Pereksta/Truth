# Painted faction heroes and physical standards

All sixteen PNG files in this directory were independently generated for Bannerlands with the built-in image generation tool and genuine alpha transparency. Each is an actual production animation atlas consumed by `Renderer.loadPaintedHeroes`, not a concept-art preview. `generation-prompts.json` records the shared production specification and each faction's identity. `manifest.json` records the final files, dimensions, byte sizes, and SHA-256 hashes.

The source view is screen-right/southeast at the same elevated three-quarter camera as ordinary troops. The renderer creates the opposite view by horizontally mirroring the complete raster frame and its anchor. There are **two visual facings**, independent of precise simulation-facing vectors. No hero uses eight- or sixteen-direction artwork, procedural weapon extensions, replacement hands, or separately attached carried flags.

The sixteen atlases have distinct bodies, silhouettes, equipment, portraits, and house standards: wolf, lion, dragon, stag, rose, sun, kraken, falcon, stylized flayed figure, twin towers, bear, fish, frog, beacon tower, huntsman, and bone. A carried pole and cloth belong to the whole hero pose. Planted, dormant, fallen, collapsing, and destroyed states use the generated standalone standards from that same house's atlas. Formation crests and objective markers remain separate command UI.

Each atlas contains an eight-column, eight-row grid, 64 painted cells:

| Cells | Authored content |
| --- | --- |
| 0–7 | Carrying idle, walk, sidearm windup/strike/recovery, fatigue |
| 8–15 | Sidearm stow, grip, lower, drive pole, steady, release, signature equip |
| 16–23 | Unencumbered ready, guard, walk, signature attack and recovery |
| 24–31 | Signature stow, grip, brace, loosen, pull free, raise, balance |
| 32–39 | Plant abort, pickup abort, fallen-standard crouch/grasp/lift/balance |
| 40–47 | Weapon handling, reload stages, aim, release, recovery |
| 48–55 | Carrying/free hits and carrying/free death sequences |
| 56–63 | Standing/wind-idle/dormant/fallen/broken/collapsing/aftermath standard, portrait |

Returned PNG dimensions need not divide evenly by eight. Extraction finds transparent gutters near each expected boundary, normalizes alpha values at or below 16 as padding (the same convention used by existing painted troops), and scans the complete raster bounds. Body scale is derived from unencumbered person poses, so a tall standard or long spear does not shrink the bearer. Source weapons, pole tips, and cloth remain intact. The Stag sheet received a reference edit to restore generous padding, complete finials, and clear transparency.

The renderer caches full-sprite mirrors, aligns interaction pole roots to the physical standard position, and suppresses the standalone object while the authored hero interaction contains it. Returning heroes without their standard use the unencumbered action set. Dead heroes finish the painted death action while their standard becomes an independent object.

Run `node source/tests/hero-art-browser.mjs` with the repository's browser-test environment to verify all 1,024 cells, transparent backgrounds, person scale, byte-exact mirrored sprites, sixteen distinct generated flags, and sixteen distinct portraits. With `LANDS_RENDER_OUT`, it writes the rendered hero/standard/portrait contact sheet, action sheet, and detailed extraction report for visual review.
