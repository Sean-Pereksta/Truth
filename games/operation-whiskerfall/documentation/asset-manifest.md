# Graphics and audio manifest

All raster graphics were created for this project with the built-in OpenAI ImageGen tool. Original generation briefs are in `assets/art-prompts.json`, `assets/ASSET_PROVENANCE.md`, and the forge/specialist prompt files. No Cat Quest assets, emoji characters, or third-party game sprite packs are used.

## Hidden expeditions · 1.9

The nine equipment, ability and creature source sheets below are bundled under `assets/expeditions/`. `PROVENANCE.md` and `prompts.json` preserve the generation briefs and source identifiers; `frames.json` records 81 measured source frames. `js/ui/expedition-art.js` registers their runtime textures, anchored animation frames and item/ability artwork. The [art gallery](../art-gallery.html) opens on the 1.9 collection and retains all earlier collections.

| Source file | Live use |
| --- | --- |
| `assets/expeditions/emberbastion.png` | Ember Bastion Armor: eight complete body poses for each of the orange and white heroes. |
| `assets/expeditions/galeweave.png` | Galeweave Mantle: eight complete body poses for each hero. |
| `assets/expeditions/seabeast.png` | Sea Beast Armor: eight poses for each hero, with jagged shells, fins and a purple tentacle mantle. |
| `assets/expeditions/winterswhisper.png` | Winter’s Whisper firearm artwork in inventory and reward presentation. |
| `assets/expeditions/winterswhisper-arms.png` | Fourteen painted trigger/support-paw attachments: seven sleeve combinations for both cat colors, measured shoulder pivots and muzzle positions. |
| `assets/expeditions/prism-sentry.png` | Eight Prism Sentry actor poses, including charge, attack, recovery and injury. |
| `assets/expeditions/kraken.png` | Eight Great Kraken poses, including lashes, ink attack, exposure and defeat. |
| `assets/expeditions/frost-breath.png` | Original Frost Breath scene in Skills and equipped-power presentation. |
| `assets/expeditions/aurora-well.png` | Original Aurora Well scene in Skills and equipped-power presentation. |

`assets/expeditions/kraken-effects.png` adds eight painted transparent frames: a reaching tentacle, raised tentacle, tidal splash, foamy wave, ink projectile, whirlpool, water spray and pearl-shell fragments. `js/ui/kraken-effects.js` animates seven of these from existing combat events and reuses the tentacle and whirlpool for Sea Beast Armor’s grasp and ink visuals. Shell fragments remain supplementary source art. The renderer preserves the exact warning shapes, hit geometry, escape gaps, lifetime and effect limits. Source measurements and generation notes are recorded in `assets/expeditions/kraken-effects.frames.json` and `assets/expeditions/KRAKEN-EFFECTS.md`.

### Painted dungeon interiors

All eight scenery sources below are bundled in `assets/expeditions/` and appear in the art gallery’s **Dungeon scenery** collection, alongside the painted walls. Each theme has an opaque ground texture and a transparent eight-prop sheet. The ground also supplies a dim painted backdrop beyond the routes, with props placed around the exposed edges. `data/dungeon-scenery-art.js` and `assets/expeditions/scenery-frames.json` supply measured prop crops and anchors to `js/world/distant-vault-scenery.js`. This presentation layer preserves the existing walkable room union, holes, mechanism positions and combat bounds. All four themes have been rendered with the game’s Canvas renderer and inspected, including the foundry’s cooled bridge; this is separate from live browser and controller acceptance.

| Source pair | Theme |
| --- | --- |
| `rimeglass-floor.png`, `rimeglass-props.png` | Frost stone, icicle pillars and reservoir pumps. |
| `cindercoil-floor.png`, `cindercoil-props.png` | Furnace grates, copper pipes and valves. |
| `zephyr-floor.png`, `zephyr-props.png` | Moss stone, wind bells and a ruined altar. |
| `drowned-maw-floor.png`, `drowned-maw-props.png` | Tidal stone, coral, shipwreck pieces and tide anchors. |

`assets/expeditions/dungeon-walls.png` supplies eight original transparent pieces: a long wall and a compact corner for each theme. `data/dungeon-wall-art.js` and `assets/expeditions/dungeon-walls.frames.json` record unequal source-cell widths, measured crops and grounded anchors. The source PNG and its alpha are unchanged; all eight crop boundaries sit inside clear gutters. `assets/expeditions/DUNGEON-WALLS.md` preserves the full generation prompt and source identity. The renderer places the pieces along exposed floor edges and draws the opaque playable floor afterward, preserving doors, shared room connections and the cooled foundry bridge.

## Deep-region enemies · 1.7

Two original transparent 4×2 sheets provide sixteen Blackglass Reaver and Cinder Mortar Rat poses. The measured expansion atlas now contains 25 textures and 220 source frames. Custom source cells contain complete fingers, tails and muzzle smoke without crossing adjacent figures; all sixteen cell edges are checked for clipping. The two-row `enemyDeep` group maps to independent source sheets and supports normal actor mirroring, feet anchors, status overlays and defeat rendering. Runtime effects draw rotating crescent blades, curved warning paths, four numbered shell marks, high bouncing shells and burning craters. See `assets/deep-enemy-art-prompts.json` for generation and revision prompts.

## Wearable armor · 1.7

Three transparent 4×4 sheets under `assets/armor/` contain 48 new player body poses: Stormrunner, Bastion and Spellweaver, each with eight animations for both cats. Their measured source crops and shoulder attachment points live in `js/ui/hero-armor-art.js`. The same artwork appears in the world, inventory, forge and discovery celebrations. Existing rotating firearm and melee arms remain separate from the bodies. `assets/hero-armor-prompts.json` records the built-in ImageGen prompts and style reference.

## Coastal expansion · 1.5

Four new 4×2 enemy sheets supply Harpoon Skirmisher, Tempest Bellringer, Shellguard and Tideblade animation. `coast/terrain.png` supplies four new ground/water textures; `coast/scenery.png` supplies eight placed scenery props. The measured atlas now covers 23 sheets and 204 frames. Coastal actor animations include dedicated windup, strike, recovery and hurt frames. See `assets/coastal-art-prompts.json` for built-in ImageGen prompts and revisions.

## Live graphics

| Asset | Use |
|---|---|
| `characters/bodies-v2.png` | 48 isolated cat body poses: two cats × three armor sets × eight idle/run/dodge/hurt/downed poses. No baked-in arms or guns. |
| `weapons/arms.png` | 36 matching arm assemblies: five gun families plus a blade for each cat and armor set. |
| `characters/friendly-cats.png` | 24 friendly full-body poses across trader, blacksmith, farmer, ranger, medic, and civilian roles. |
| `characters/actors.png` | Original 64-pose sheet; infantry and officer rows animate ordinary mouse enemies. Cat rows remain reference art. |
| `enemies/specialists.png` | 48 poses for leapers, bruisers, mortars, sappers, skirmishers, and frost troops. |
| `buildings/scenery.png` | 24 trees, structures, military props, rocks, chests, and scenery. |
| `buildings/landmarks.png` | Eight major props: fortress, cave, prison, truck, merchant, farm, war machine, willow. |
| `buildings/forge.png` | Transparent resistance forge with furnace, anvil, and tools. |
| `terrain/terrain.png` | Eight opaque terrain textures. Roads, rivers, banks, bridge crossings, and weather are layered over them. |
| `weapons/items.png` | Firearms, blades, armor/gear icons, aircraft, explosion frames, pickups, and effect sprites. |
| `ui/meowquest-cover.png` | Current MeowQuest title cover, with oversized title lettering and a responsive campaign panel. |
| `ui/title.png` | Earlier panoramic illustration retained as reference. |

The original atlas metadata describes **18 textures and 582 source frames**, including bonus/reference textures. The expansion adds **17 textures and 160 source frames**, recorded separately in `assets/expansion-atlas.json`. Runtime rendering uses individual source rectangles; it never displays an entire atlas as a character.

## Illustrated encounter expansion

| Sheets | Frames and use |
|---|---|
| `enemies/roller.png`, `blinkstalker.png`, `fencer.png`, `burrowrat.png` | Eight poses each for the armored roller, delayed teleporter, fencing duelist, and tunneling rat. |
| `enemies/cinderbeast.png`, `venomrat.png`, `frostwarden.png`, `voidknight.png` | Eight poses each for the four deeper-region elemental opponents. |
| `enemies/ironrat.png`, `gloamwing.png`, `motherbriar.png`, `hollowking.png` | Eight poses each for the four cavern guardian families. |
| `dungeons/dungeonProps.png` | 16 masonry, vegetation, gate, stairs, mural, and treasure props. |
| `dungeons/puzzleDevices.png` | 16 rune, mirror, receiver, conduit, star, and seal pieces. |
| `dungeons/dungeonFloors.png` | Eight opaque regional stone textures. |
| `dungeons/dungeonFX.png` | 16 beam, impact, portal, elemental, blade, and warning effects. |
| `dungeons/encounterProps.png` | Eight charges, remote switches, camp supplies, barricade, brazier, and gong props. |

Open `art-gallery.html` for an animated library. The source briefs and final roller revision prompt are included in `assets/`. `tools/build-art-atlas.cjs` measures original PNG pixels and rebuilds the metadata and runtime helper; it does not rewrite the images. Gameplay warning shapes and puzzle connections remain exact code-drawn overlays.

## Animation alignment

The active body atlas has eight columns and six outfit rows. Frames have generous gutters. Measured main-component crop bounds exclude neighboring shapes and faint edge residue. Per-outfit height and foot baselines keep the character stable across the run cycle. The movement clock is independent of shooting/recoil, so repeated fire does not restart the legs.

The arms atlas uses measured, nonuniform column bounds and row bands. It must not be treated as a naive equal-cell sheet. Gun/arm assemblies attach at the torso, use a shoulder pivot, and mirror for leftward aiming with a local rotation kept within ±90 degrees. They therefore stay upright. Reload motion, recoil, and blade swings animate this separate layer. The attachment anchor is documented and tested in `tests/rendering.test.cjs`.

Friendly cats also use exact measured source crops and real walking frames. Specialists use their own attack poses and a vertical jump offset with a ground shadow during leaps.

## Bonus/reference graphics

The six `{orange,white}-{scout,ranger,vanguard}.png` sheets contain another 240 fully illustrated cat poses with five gun families per outfit. They were completed before the final modular design was chosen. They remain available in the graphics ZIP and are excluded from active game texture loading. `characters/bodies.png` is the earlier body atlas retained as reference; active play uses `bodies-v2.png`.

## Effects and audio

Explosion sequences, muzzle flashes, impacts, smoke, fire, healing, aircraft, and pickups use the item/effect atlas with Canvas compositing. Readable charge lanes, landing circles, sniper sights, ground hazards, beams, lightning arcs, and controller crosshairs are lightweight vector effects around the raster actors.

`audio/manifest.json` lists 36 original PCM WAV effects and ambient sounds. `music/score.json` describes three original exploration/combat/boss themes and their matching WAV renders. The live game synthesizes the sounds and motifs locally through Web Audio rather than fetching the WAV exports. Separate music, effects, and interface controls are provided. Sound starts after a user gesture.

The manifest also lists sixteen CC0 cat and rodent character clips in `audio/animals/`. Their sources, edits, and checksums are recorded beside the WAVs. `data/animal-sounds.js` embeds those exact files for offline playback; `tools/build-animal-audio.cjs` rebuilds the bank. These sample voices use the effects bus, randomized bags and slight pitch variation, distance attenuation, stereo position, cooldowns, and a three-voice limit.

## Remote hosting

The graphics ZIP places `characters`, `weapons`, `terrain`, `buildings`, `enemies`, and `ui` directly at its root. Preserve that layout in an R2/public CDN prefix. Set `OW.config.assetBaseURL` to this prefix; the game strips the initial `assets/` from its local graphic paths when constructing remote URLs. Atlas `image` fields are relative to the game root; strip that same `assets/` prefix when consuming the metadata directly from the graphics bucket.

All selected project images are physically included in the package. No runtime asset points to a generation scratch directory. The full game ZIP includes graphics, source, data, audio, music, tests, and documentation; the graphics ZIP excludes audio and music.

## Resistance preview additions (1.8)

- `assets/resistance/lanternline.png`, `breachmaker.png`, `signalstorm.png`: original transparent weapon source art, fitted to inventory icons and reward artwork.
- `assets/resistance/lastwatch.png`, `blackglass.png`: original orange/white hero armor animation sheets, with explicit pose/crop mappings.
- `assets/resistance/arms.png`, `arms-blackglass.png`: original painted weapon attachments with trigger and support paws for all three new guns, both cat colors, and matching outfit sleeves.
- `assets/resistance/frames.json`, `PROVENANCE.md`, `prompts.json`: source measurements, source/generation notes and authored prompts.
- `js/ui/resistance-art.js`: asset registration and presentation integration. Existing source files retain their provenance.
