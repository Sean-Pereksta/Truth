# Original artwork and animation reference

## Deep-region enemies · 1.7

`enemies/blackglass-reaver.png` and `enemies/cinder-mortar.png` are original eight-pose transparent animation sheets generated with built-in ImageGen. Exact initial and layout-revision prompts are in `deep-enemy-art-prompts.json`. Source pixels and alpha are preserved; measured frame rectangles, stable scale and feet anchors are produced by the existing atlas builder. The renderer uses the dedicated throwing, firing, recoil, catch, reload and hurt artwork alongside code-drawn curved crescent trails, high bouncing mortar shells, warnings and burning craters. Both sheets are bundled for offline play and shown in the art library.

## Wearable masterwork armor · 1.7

`armor/stormrunner.png`, `armor/bastion.png` and `armor/spellweaver.png` provide 48 original modular cat body poses: eight animations for each armor on both orange and white cats. These were generated with built-in ImageGen using the existing hero body sheet as a style and identity reference. Exact prompts are in `hero-armor-prompts.json`. The sheets contain torso armor, capes, heads, legs, tails and shoulder caps; the existing rotating weapon arms attach during gameplay. Generated pixels and true transparency are preserved.

## Illustrated abilities · 1.6

`abilities/field-abilities.png` and `abilities/arcane-abilities.png` contain 24 distinct painted ability scenes in two 4 × 3 atlases. `abilities/spell-effects.png` contains twelve transparent in-world effect sprites. All three sheets were generated with built-in ImageGen; exact prompts are in `ability-art-prompts.json`. Source pixels and transparency are preserved. Menu SVG viewports crop each illustration, while the renderer uses the transparent effect cells directly at animated positions. No generated asset depends on a local machine path.

## Coastal expansion · 1.5

Four original eight-pose enemy sheets (`enemies/harpooner.png`, `bellringer.png`, `shellguard.png`, and `tideblade.png`) and two environment sheets (`coast/terrain.png`, `coast/scenery.png`) were created with built-in ImageGen. These supply 32 actor poses, four opaque ground/water textures and eight transparent scenery props. All prompts, including revisions for sprite separation, are in `coastal-art-prompts.json`.

Source pixels are preserved. Measured source rectangles include the complete harpoon extension and the irregular landmark footprints; the metadata builder validates all crop bounds. All six sheets are portable bundled game assets and appear in the art library.

## MeowQuest title cover and creature voices · 1.4.1

`ui/meowquest-cover.png` is an original cover generated with the built-in ImageGen tool for **MeowQuest: the Purr'd Reich**. Its full prompt is recorded beside the image. The prior title illustration is retained as an unused legacy asset.

Animal voice clips under `audio/animals/` are CC0 recordings and performed effects; see [their source credits](audio/animals/SOURCES.md) and exact edit metadata in `audio/animals/sources.json`. These third-party sounds are separate from the original synthesized weapon effects and music.

## Illustrated encounters expansion · 1.3

The expansion adds 17 original PNG sheets with 160 source frames: eight enemy sheets and four guardian sheets with eight poses each, plus 16 architecture props, 16 puzzle devices, eight regional floors, 16 effects, and eight encounter props. Enemy and guardian sheets live in `enemies/`; the five environment sheets live in `dungeons/`.

All expansion images were created with OpenAI's built-in image generation tool. The selected generation prompts are saved in `expansion-art-prompts.json`; `roller-revision-prompt.txt` records the final roller correction. `expansion-art-sources.json` maps the selected sheets to runtime roles, and `expansion-atlas.json` records measured frame bounds, scale, and anchors. Source PNG pixels are preserved. The fencer's extended rapier tips are drawn from additional measured source strips so they remain complete without importing neighboring poses.

Open `../art-gallery.html` to inspect animated previews and full source sheets. Runtime illustration is layered with exact puzzle symbols, beam paths, and attack warning geometry.

## Original campaign artwork

All PNG artwork in this package was created for Operation Whiskerfall using OpenAI's built-in image generation tool. The project does not use Cat Quest graphics or other third-party game sprites. The style is an original colorful animal resistance adventure with fictional military insignia. No real-world extremist symbols are used.

The live player system is modular. `characters/bodies-v2.png` contains 48 original body poses, with a full head, torso, legs and tail and no arms or weapons. Its six rows are orange Scout, orange Ranger, orange Vanguard, white Scout, white Ranger, white Vanguard. Eight columns are idle, four running poses, dodge, hurt and downed. `weapons/arms.png` contains 36 matching pairs of arms holding five firearm families or a blade. It uses measured source rectangles recorded in `atlas.json`, rather than assuming the generator's whitespace is a regular grid. Its six rows match the body outfits; columns are pistol, SMG, rifle, shotgun, launcher and blade. Gameplay rotates the arms around their shoulder pivot, mirrors them for leftward aiming, and keeps the body upright. The running clock is independent of the firing clock. Recoil, reload movement and knife swings animate the arms layer.

`characters/actors.png` contains 64 original animation poses: orange cat, white cat, mouse infantry and mouse officer, each with eight running and eight combat frames. The combat frames include two aiming, two firing, two actual knife-swing, one reload and one hurt frame. The mouse rows remain active in gameplay. Cat rows are retained for reference.

The six `characters/{orange,white}-{scout,ranger,vanguard}.png` sheets contain 240 additional full character poses with held firearms. Each sheet has five weapon-family rows and eight poses per row. These were completed before the player design changed to modular arms; they are included as bonus artwork and armor thumbnails. Active players use the modular sheets.

`buildings/scenery.png` contains 24 isolated environment sprites. `buildings/landmarks.png` adds eight large landmarks and props: fortress, cave, prison cage, supply truck, merchant, farm plot, war machine and willow. `buildings/forge.png` is an original resistance workshop with furnace, anvil and tools. `terrain/terrain.png` contains eight opaque ground texture tiles. `weapons/items.png` contains eight firearms, blades and gear, an eight-stage explosion sequence, pickups and effects. `ui/title.png` is an original panoramic title illustration. `enemies/specialists.png` contains 48 additional mouse specialist poses; the project documentation records their enemy roles.

`atlas.json` lists exact pixel frame rectangles, normalized pivots, row/column labels, sequence timings and whether each texture is used during gameplay or retained as bonus reference artwork. Integer edges are rounded independently to prevent incorrect whole-sheet rendering. Alpha is preserved on every character, weapon and prop PNG. Terrain and title art are intentionally opaque.

Generation briefs are preserved in `art-prompts.json`. Images were inspected after generation. The renderer uses only individual frame rectangles and culls distant sprites; terrain chunks are cached and the cache is bounded.

The final runtime body atlas is `characters/bodies-v2.png`. It was regenerated with smaller isolated sprites and generous empty space. The renderer and metadata use measured bounds around the main alpha component in every frame, fit each outfit to a consistent68px idle height and preserve a shared foot baseline. The earlier `bodies.png` is included as reference art. `characters/friendly-cats.png` adds24 original full-body friendly poses across trader, blacksmith, farmer, ranger, medic and civilian roles; these animate in settlements, escort missions and liberated outposts. No image pixels were edited programmatically: inspection measured alpha bounds and the renderer crops the original generated images.

## Resistance preview artwork (1.8)

Seven original generated transparent sheets add Lanternline, Breachmaker and Signalstorm equipment art, Last Watch / Blackglass Pathfinder appearances for both heroes, and matching illustrated arm attachments with gripping paws. See `resistance/PROVENANCE.md` for the generation source and prompt records, and `resistance/frames.json` for measured frame crops. New runtime artwork is registered by `js/ui/resistance-art.js`; no remote asset fetch is required beyond the project's configured asset base.
