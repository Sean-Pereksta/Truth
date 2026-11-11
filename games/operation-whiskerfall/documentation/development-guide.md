# Development guide

MeowQuest the Purr’d Reich is a complete static browser project. Its runtime uses JavaScript, Canvas 2D, DOM menus, the Gamepad API, Web Audio, and local storage. It has no package installation, build step, backend, database, or runtime CDN dependency. Optional Node commands below are developer tools; players do not need Node.

## Version 1.9 extension order

`index.html` is the authoritative script order. After the 1.8 content extensions, load `data/expedition-gear.js`, `data/rare-abilities.js`, then `data/distant-vaults.js`, before constructing the world. Follow those data scripts with `data/dungeon-scenery-art.js` and `data/dungeon-wall-art.js` so measured prop and wall frames exist before their renderer loads. Keep the content append order in export tools: saved weapon, enemy and ability indices must not move. Frost Breath and Aurora Well append at ability indices 24 and 25. Their `questOnly` flag and stable IDs control ownership; the legacy-compatible `unlockCost: 1` sentinel is not a purchase price.

After `js/core/guardian-progression.js`, load the following extensions in order:

1. `js/core/expedition-gear.js` and `js/quests/expedition-rewards.js` apply special equipment effects and one-time quest grants for active and resting heroes.
2. `js/core/rare-abilities.js` supplies the rare-power dispatcher used by the original cast/cooldown pipeline. `js/core/prism-sentry.js` adds its warned paired-lane attack.
3. `js/world/distant-vaults.js` supplies key caches, cave geometry, mechanisms and persistence, followed by `js/world/distant-vault-scenery.js` for interior presentation. `js/core/kraken.js` then adds the optional guardian encounter.
4. `js/ui/expedition-art.js` registers the new illustrated actors, equipment, gripping arms and ability cards. `js/ui/kraken-effects.js` follows it to draw the painted kraken and Sea Beast effects over the existing attack geometry.
5. `js/save/expedition-save.js` wraps validation after every feature has registered its optional saved fields. `js/ui/coop-menus.js` comes last, so each personal pane uses the completed Inventory/Skills renderer and action chain. `css/rare-expeditions.css` and `css/coop-menus.css` follow the earlier UI styles.

The scenery renderer caches the painted background and ground, extracts exposed edges from the floor union, and places measured wall/corner pieces outside that union before the opaque playable floor is drawn. Do not decorate every room rectangle independently: shared internal edges and the cooled foundry bridge must remain open. Both scenery metadata/image identity and solved bridge state invalidate the cache. Wall atlas cells have unequal column widths; always use `OW.DungeonWallArt.frames` crops and anchors rather than dividing the image into equal quarters.

Game construction is deferred until these wrappers are installed. Keep the input hooks in `js/input/input.js`: they route personal-menu controls before shared-menu keyboard fallback and prevent a focused DOM control from receiving a second native Enter activation. A personal pane has a fixed owning hero and its own focus, category, selection and scroll state. Either open pane pauses shared combat. Global menus suspend and restore both personal panes; overlay state is never saved. See [co-op menus](coop-menus.md) for bindings and routing contracts.

`distantVaultKeys` serializes the permanent shared key Set. `distantVaultKeyRuns` stores guarded cache inhabitants; each new `dungeonStates` entry retains dense boolean `vaultNodes`, guardian progress and treasure completion. `krakenPartySize` fixes one- or two-hero health at first entry, and loading preserves an injured boss’s health fraction while cancelling pending threats. Each hero retains separate `expeditionRewardClaims`, `rareAbilityClaims`, learned abilities, equipment, ranks and cooldowns, including while resting. Missing new fields are valid legacy data; malformed fields and a keyed active dungeon without its key are rejected before hydration or save replacement. Never serialize personal panes or the temporary equipment-effect WeakMaps.

## Version 1.8 extension order

Load `data/resistance-invasions.js` and `data/resistance-rewards.js` after the 1.7 data extensions. The early world chain is `world.js`, `resistance-camps.js`, `deep-enemies.js`, then `resistance-fronts.js`; this also lets tooling export the invasion locations without loading the game runtime. `js/quests/resistance-invasions.js` follows checkpoints. After the existing discovery UI, load resistance rewards, resistance gear, resistance art and the armor wardrobe, followed by ability upgrades, readable combat and guardian progression. This is the base wrapped by the 1.9 modules above.

Guardian progression derives canonical statistics from region and saved party size, preserving the remaining health fraction on migration. Its attack rosters expand by regional tier without rewriting original guardian IDs. Checkpoint reset, loading and re-entry must not compound scaling. The wardrobe preserves the ordinary item/equip action contract and adds discoverable quest rewards without granting them or bypassing their source requirements.

## Version 1.7 extension order

Load `data/deep-enemies.js` after `data/coastal-enemies.js`, and `js/world/deep-enemies.js` immediately after `js/world/world.js`. The new enemy definitions occupy append-only indices 48 and 49; deterministic reinforcements use a separate random stream and stable IDs. Load `js/core/blackglass-reaver.js` and `js/core/cinder-mortar.js` after coastal enemy runtime but before `js/quests/coastal-defense.js`, so defense proxies remain available during their custom effects. The existing checkpoint and save wrappers then surround both systems. Actor artwork uses the two-row `enemyDeep` atlas group. See `deep-enemies.md` for placement and compatibility notes.

Load `data/hero-armor.js` after the other content extensions and `js/core/hero-armor.js` after combat polish. Masterwork items occupy the normal armor equipment slot; their visual style overrides the existing three base outfits without changing outfit indices or reinforcement ranks. Their temporary combat bonuses live outside saved player data and clear on defeat, travel and load. Load `js/ui/hero-armor-art.js` after the existing equipment/dialogue UI, followed by `hero-armor-ui.js` and `discoveries.js`. Discovery receipts extend snapshots; old saves treat already-owned gear as seen. Receipts never grant items or bypass the original reward transaction.

## Version 1.6 extension order

Load `js/ui/ability-art.js` after the renderer and before the UI. After the 1.5 runtime chain and checkpoints, load combat-polish, spell-visuals, quest turn-in, equipment-modern, then dialogue-modern in the order recorded in `index.html`. The UI stylesheet extensions follow the base stylesheet. The renderer asset registry includes the transparent spell atlas before game initialization. Painted menu artwork supports the same optional asset base URL.

Quest completion now has an objective-ready state and a separate completed/rewarded state. `questProgress.readyForTurnIn` identifies return journeys; legacy `ready` is true only inside the selected reward transaction. `finishQuestFromNpc` checks the recipient, range and active dialogue. Existing completion wrappers remain responsible for shared rewards and one-time coastal choice ledgers. `readyQuestTurnIns` and `questTurnInVersion` support saves without changing existing completed IDs. Pure speaking objectives are completed by opening the correct NPC conversation.

Combat input buffers live in a WeakMap rather than saved player data. Menus, travel, loads and checkpoint recovery clear them. The spell renderer changes presentation only; combat radii, hit timing, cooldowns and damage remain controlled by their original gameplay methods.

## Version 1.5 regional content

`data/coastal-enemies.js`, `data/stormglass.js`, and `data/coastal-defense.js` append four enemy definitions, two adjacent regions, twelve NPC quests and two reward items. Load them in that order after core encounter data and before world generation. The original eight-region coordinates are unchanged; eastward world width is now 23,400. New scenery uses an independent deterministic random stream. The nine campaign bosses and Berlin gate remain unchanged.

After dungeon and encounter runtime, load `js/core/coastal-enemies.js`, then `js/quests/coastal-defense.js`; the latter keeps defense supply proxies active during coastal effects. Load `js/core/checkpoints.js` after those systems so it preserves their cleanup and save wrappers, followed by the 1.6 extension chain above. Latest checkpoint IDs, downed states, reward counters and active wave ledgers are persisted. Content regeneration includes the expansion; the art builder preserves custom measured source cells.

## Version 1.4.1

The title cover and display branding now use MeowQuest. Internal save keys, export-format identifiers, and campaign content IDs retain their original values for compatibility. Sixteen CC0 animal clips are embedded in `data/animal-sounds.js`, loaded before the audio runtime, and decoded after audio initialization. Rebuild their bank with `node tools/build-animal-audio.cjs`; full content regeneration also invokes this builder. `assets/audio/animals/SOURCES.md` and `sources.json` preserve source and editing provenance.

## Version 1.3

Dedicated animation sheets illustrate the eight new enemy types and four cavern guardians. Dungeon floors, architectural props, puzzle devices, effects, and encounter objects share a consistent visual treatment. Source frames are fitted at draw time while preserving the original generated PNG pixels and alpha channels. Mechanical overlays keep puzzle ports, symbols, reflected beam paths, and attack warnings aligned with gameplay.

The expanded world covers 69% more area and uses planned valley roads, caravan routes, settlement lanes, and cave trails. Its sixteen enterable caverns now include twelve puzzle chambers and four survival trials, four guardian families, and sixteen vault quests. Four camp-defense and four remote-demolition assignments bring the catalogue to 137 quests. The game retains 53 firearms, 44 regular enemy roles, six functional encounter armors, and 36 NPCs with 288 branching conversation nodes. Shops carry small regional selections; unusual equipment is earned from encounters. Controller navigation scrolls through nested lists in either direction, tracked quests receive a screen-edge direction arrow, and explicit coordinate migration preserves older campaigns.

## Source layout

- `config.js` sets the asset base URL, world seed, and entity limits.
- `data/content.js` defines the core catalogue, reward sources, regional combat scaling, and mission/NPC profiles. `data/dungeons.js` appends the sixteen cavern definitions and vault quests. `data/encounters.js` assigns four of those caverns to survival trials and adds eight surface assignments. The adjacent JSON catalogues are readable exports for tooling and future editors.
- `js/world/world.js` builds deterministic geography, location metadata, collision footprints, spawn definitions, and spatial indexes. It streams enemies around both players.
- `js/world/renderer.js` owns terrain caching, atlas frames, entity rendering, animation, lighting, weather, and visible effects.
- `js/world/dungeons.js` implements interior geometry, visible puzzle mechanisms, guardian behavior, treasure claims, transitions, interior rendering, and persistence.
- `js/core/spatial.js` supplies local combat searches and bounded reusable entity pools.
- `js/core/art.js` supplies the illustrated sheet manifest, measured frame bounds, and aspect-preserving frame drawing. Enemy and guardian animation states select individual frames rather than displaying an entire sheet.
- `js/core/abilities.js` implements learned active powers, ownership checks, per-ability cooldowns, progression migration, combat effects, and their visual overlays.
- `js/core/audio.js` synthesizes original effects, ambient audio, and an adaptive score, and plays the embedded animal recordings. It begins after a player gesture.
- `js/main.js` owns the game loop, movement, combat, enemy behavior, abilities, progression, rewards, quests, events, and the connection between systems.
- `js/quests/missions.js` adds authored objective steps, live escorts and defenses, and their saved state.
- `js/quests/encounters.js` extends those systems with staged survival waves, camp integrity and retries, planted-charge state, remote interlocks, encounter artwork, and wave counters.
- `js/ui/conversations.js` provides branching dialogue, remembered replies, and local discovery leads for all 36 named contacts.
- `js/input/input.js`, `js/ui/ui.js`, and `js/save/save.js` handle input, menus, and persistence.

Scripts are plain deferred scripts loaded in the order listed in `index.html`; shared APIs are under `window.OW`. Load `data/encounters.js` after `data/dungeons.js`, `js/core/art.js` before the renderer, `js/core/abilities.js` after `js/main.js`, and `js/quests/encounters.js` after both mission and dungeon runtime scripts. The extension modules wrap the original campaign APIs. Keep the same content order in export tools. No files are loaded through JavaScript `fetch`, so the normal local build can run directly from `index.html`.

## Historical world and content inventory · 1.3 baseline

The figures in this section describe the original 1.3 expansion. Later version sections above document appended regions, encounters, gear and powers; current exported catalogues live under `data/` and `maps/`.

The configured seed is **763219**. Its overworld is **18,720 × 14,560 world pixels**. The eight 4,680 × 7,280 regions form two rows, with campaign order running left to right across the northern row and right to left across the southern row. This is 1.3 times the previous distance scale and 1.69 times its area. Each region has a main valley road; caravan roads connect regions, short branches serve major sites, and narrow trails reach cave entrances. Individual NPCs and services do not generate regional road spokes. A southern bypass avoids the sealed Berlin sector. Rivers bend around settlements and have passable timber bridges at crossings.

The shipped catalogues contain:

| Content | Count |
|---|---:|
| Regions / regional commanders / final boss | 8 / 8 / 1 |
| Named endgame sectors / bounty centers | 1 / 20 |
| Regular enemy roles | 44 |
| Firearms, including experimental weapons | 53 |
| Melee weapons | 20 |
| Tactical abilities | 24 |
| Armor, helmets, and accessories | 78 |
| Functional encounter-only armors | 6 |
| Main missions / side missions | 25 / 112 |
| Vault quests / puzzle mechanisms / guardian families | 16 / 4 / 4 |
| Puzzle caverns / survival caverns | 12 / 4 |
| New camp-defense / remote-demolition assignments | 4 / 4 |
| Enemy bases, excluding boss arenas | 32 |
| Peaceful settlements / forges / named quest cats | 20 / 20 / 36 |
| Branching conversation nodes | 288 |
| Supply caches / cave entrances | 24 / 16 |
| Courier routes / defense posts | 8 / 8 |
| Total named locations | 248 |
| Original sound effects and ambient WAVs | 36 |
| Original musical themes | 3 |

The configured overworld generates **485 enemy spawn definitions** and approximately **5,600 indexed scenery and structure objects**. Compared with version 1.2, the added objective layout excludes three ordinary Blackbanner patrol spawns; no commander, installation guard, or named quest target is removed. A different seed changes decoration and patrol placement. Boss encounters and installations use stable IDs. The sixteen cave entrances transition into playable interiors with persistent puzzle or survival, guardian, and treasure state. Sixty decorative friendly cats populate peaceful settlements, while eighty-two additional resistance cats appear at liberated installations; their wandering does not add combat AI simulation. Named conversational NPCs are separate from those decorative cats.

Equipment uses a finite catalogue with upgrade ranks and modifiers. Firearms can be upgraded ten times. `rewardOnly` and `rewardSource` distinguish encounter treasure from the small selections returned by `Game.shopInventory(location)`. Basic purchased firearms retain commander blueprint, core, gold, and level requirements. Most unusual firearms and six special armors come from commanders, named reward targets, or cavern guardians; purchases reject those rewards even if their IDs are supplied directly. Ordinary enemies only provide supplies, scrap, and currency. `Content.bossRewards` and `Content.dungeonRewards` identify guaranteed sources. Three visual armor outfits per character remain separate from stat-bearing armor and accessory items. The forge upgrades and tunes equipment; it is not a universal catalogue of purchasable weapons.

The six reward armor modifiers are `rollshell`, `wayfarer`, `rimeheart`, `venomskin`, `cinderproof`, and `phaseweave`. Their effects include dodge knockback and recovery, movement and dodge reloads, cold protection and frost pulses, poison resistance and healing, fire resistance and burning trails, and extended dodge protection with periodic kill shields.

Weapon definitions include a `mechanic`, a readable `mechanicName`, and `mechanicDescription`. The advanced catalogue adds burst fire, heavy slugs, charging, ricochets, guided rockets, beams, wide spreads, fire, stacking poison, freezing, shatter combinations, and explosive ammunition. Metadata includes burst count and timing, penetration, terrain and enemy bounce counts, homing strength, beam width, charge time, heat and cooling, and barrel spin-up. Six tactical abilities unlock by hero level three so the player can experiment with more than the starting two powers.

## Active abilities and training

The catalogue contains 26 active abilities. Original indices 0–11 retain their level unlocks; indices 12–23 are learned through the Skills screen. The two 1.9 powers at indices 24–25 require their named quests and cannot be purchased or refunded for points. Each hero starts with three skill points and earns two per level. Older profiles receive a one-time compensation of three points plus one per completed level, tracked by `skillBookVersion`. Learned IDs and per-ability cooldowns are stored on each hero, including a resting co-op hero. Equipping, cycling, inventory actions, and casting all enforce the same ownership and level rules; swapping slots does not erase cooldowns.

| New ability | Level / points | Effect |
|---|---:|---|
| Dashstep | 1 / 1 | A protected dash along the current aim, stopped by walls and seals. |
| Aegis Field | 1 / 1 | A temporary damage-absorbing personal barrier. |
| Frost Nova | 2 / 1 | Nearby ordinary enemies freeze; bosses take damage and chill. |
| Field Supply | 2 / 1 | Nearby standing heroes receive ammunition, a medkit, and grenades. |
| Mirror Ward | 3 / 2 | Hostile projectiles reflect back as friendly shots. |
| Venom Fan | 3 / 1 | Seven piercing poison needles spread across the aim direction. |
| Gravity Well | 4 / 2 | A placed field pulls ordinary enemies and pulses damage. |
| Overdrive | 4 / 2 | Firearms recover between shots faster while preserving ammunition and heat rules. |
| Vital Siphon | 5 / 2 | Drain up to three enemies in a forward arc and heal from actual damage. |
| Grapple Hook | 5 / 2 | Pull an ordinary target toward the player, stopping at cover. |
| Revival Beacon | 6 / 2 | A stationary healing field revives a nearby fallen partner after two seconds. |
| Orbiting Blades | 8 / 3 | Four orbiting blades damage enemies along their actual paths. |

Six passive branches remain available alongside the active catalogue. Each rank costs one point. The menu exposes locked cards, requirements, point balance, and both equipped slots; controller traversal includes offscreen rows and the passive section.

Ordinary kills no longer roll equipment or rare-core lotteries. Their rewards are currency, scrap, ammunition, and medicine. Commander caches provide guaranteed regional rare gear, and named mission targets and cavern reliquaries provide additional explicit sources. Reward item descriptions identify their source; first/fifth archetype kills no longer grant rare weapons.

`restoreCommanderRewards()` migrates previously defeated commander sites using a separate `commander-cache-v2` ledger. It checks active and resting heroes and pending persistent drops before granting missing items. Migration runs while loading the overworld, before restoring a cave visit. Dungeon load and campaign start clear stale surface drop and ally stashes, so repeat loads cannot suppress rewards using a previous scene's state.

Every peaceful settlement has a 500-pixel safe radius, a nearby forge, and a named quest scout. Spawn placement rejects both solid footprints and safe areas. The game loop enforces peaceful refuge behavior during combat as well.

## Streaming and collision

World chunks are 640 pixels wide. `world.updateActive(players, dt, game)` considers a 1,450-pixel radius around **each** player and refreshes membership approximately every 0.35 seconds or on chunk changes. At most 160 enemies become active. Definitions outside this area consume no AI updates. Their remaining health and positions are preserved when unloaded; defeated enemy IDs never respawn.

`updateActive` manages membership and spatial lookup only. It does not move enemies or resolve combat. Gameplay creates temporary enemies through `world.addEnemy(enemy)` or by adding an `ephemeral: true` enemy to `activeEnemies`. They survive nearby chunk refreshes. Generic transient reinforcements are not restored by the world-state serializer; active mission enemies are saved and restored separately by the mission integration, and dungeon inhabitants use their interior snapshot.

Scenery metadata is inexpensive and remains in memory, while object queries and drawing use chunk indexes. `getVisibleObjects(x, y, w, h)` accepts a world-space viewport rectangle. `isBlocked(x, y, radius)` tests map edges, exact indexed river geometry, and nearby sprite footprints. Tree tops overhang a small trunk footprint; building and wall footprints leave approach routes open. Road crossings override river collision for bridges.

`regionAt` returns the region object. Both `region.id` and `region.index` are numeric; `region.slug` is a stable readable identifier. `terrainAt` returns `{type, region, height, moisture, biome}`. `safeZoneAt(x, y)` uses an exact spatial refuge index. `steerAround(enemy, target, dt)` returns `{mx, my}` for obstacle avoidance, checking full footprint rays and caching a heading for 0.5–0.8 seconds. It does not move the enemy. Roads contain `x1`, `y1`, `x2`, `y2`, `width`, `points`, `kind`, and `name`; kinds distinguish highways, arterials, lanes, trails, and local paths. Road collision queries use a chunk index. `groundDetails` provides plazas, camp yards, cave aprons, and frontier markings. Rivers are polylines with a width. Read `maps/world/world.json` and the eight `maps/regions/*.json` files to inspect the exported layout.

## Extending content

Add catalogue entries in `data/content.js`. Use unique stable item, mission, and location IDs, because saves reference them. Firearm and melee equipment refer to numerical catalogue indices, so append new entries rather than reordering existing ones. Enemy spawn definitions also use numerical type indices.

An enemy entry declares health, damage, speed, range, firing rate, experience, role, and color. Firing rates are shots per second. New AI behaviors require a matching gameplay branch and readable renderer cues. Indices 24–29 cover leaper, bruiser, mortar, sapper, skirmisher, and frost; indices 30–35 contain the Berlin specialists. Version 1.2 appends `roller`, `blinkstalker`, `fencer`, `burrowrat`, `cinderbeast`, `venomrat`, `frostwarden`, and `voidknight` at indices 36–43. Rollers use windup, straight rolling, and exposed recovery states; their rolling shell reflects shots. Blink stalkers mark a recorded target position before attacking, and fencers telegraph their lunges. Regional health and damage scaling is applied once, with the applied scale preserved in saves.

The original reusable objective types are `liberate`, `boss`, `kill`, `explore`, `cache`, `rescue`, `convoy`, `escort`, `defend`, `assassination`, and `bounty`. Authored operations add multi-step actions, and `dungeon` quests use the persistent cavern completion state. Place targets reference actual location IDs; regional kill targets use numeric region indices. Assassinations and bounties reference stable named enemy spawn IDs and include `targetLocation` and `targetName` for map guidance. Main quests link through `prerequisite` IDs. Rescue and convoy objectives complete when their corresponding prison or supply depot is cleared.

Each courier mission has `startX`, `startY`, a destination, and passable `waypoints` following the town road for approximately 900 pixels in the expanded coordinate space. Defense missions use a clear road post outside all refuge circles, a 45-second duration, and three waves. Assassinations identify one named officer rather than requiring the entire base to fall. Bounties identify a named armored general at a supply depot. Quest profiles list relevant local missions and expose them through peaceful settlement NPCs. New mechanics should extend the corresponding mission or dungeon system explicitly.

Town IDs include `town_0` through `town_7`, `town_extra_0` through `town_extra_3`, and `town_way_0` through `town_way_7`. Each has `forge_` and `npc_` prefixed companion locations. The first forge is at **1730, 1670**; the first quest scout is at **1515, 1530**. Player one starts at **1430, 1430**; the first occupied checkpoint is at **2600, 1950**. Prefer querying these locations by ID instead of duplicating coordinates in gameplay or tests.

Authored region and mission coordinates in `data/content.js` retain the original 3,600 × 5,600 regional units. `World.prepareContentCoordinates()` transforms region bounds, sectors, and mission positions once to scale 1.3 before a world is built. Do not pre-scale those definitions a second time. Building footprints, NPC offsets within settlements, weapon ranges, and movement speeds remain in gameplay pixels.

## Cavern puzzles and guardians

`data/dungeons.js` assigns each `cave_<region>_<variant>` a puzzle, guardian family, and `vault_<region>_<variant>` quest. `data/encounters.js` marks `cave_1_1`, `cave_3_1`, `cave_5_1`, and `cave_7_1` with `encounter: 'survival'`; their existing IDs and reward pairs remain unchanged. `js/world/dungeons.js` owns a separate local interior coordinate space, collision, actors, rendering, and transitions. Both local players enter together, and returning restores their overworld entrance positions.

| Mechanism | Player action | Visible feedback |
|---|---|---|
| Echo runes | Shoot four marked rocks in the mural's order; a wrong rock resets progress | Symbols and lit seals show the sequence and accepted shots |
| Mirrors | Rotate mirrors with Interact or a shot to guide light to the receiver | A traced beam reflects through the current mirror orientations |
| Water conduit | Rotate pipe joints until the spring connects to the wheel | Connected pipe sections light with flowing water |
| Constellation | Shoot a star to toggle it and both neighboring stars | The current lights can be compared with the target pattern |

Solving a mechanism opens the guardian chamber. The four families are Gravelback the armored rat, the Gloamwing bat, Mother Briar the spider, and the Hollow King burrower. Their attacks include reflected rolling charges, ice volleys and swoops, poison/web area attacks, and marked burrow strikes. The reliquary remains locked until its guardian dies. Claiming it grants the configured encounter rewards once and completes the vault quest. `dungeonStates` retains mechanism state, inhabitants, guardian defeat, and treasure claims; `activeDungeon` restores an in-progress visit.

## Survival, camp defense, and demolition

The four survival caverns contain three, three, four, and four waves in ascending regional order. Interacting with the watch altar at local position `(580, 650)` starts a trial; merely entering the room does not. `dungeonStates[caveId].survival` records the phase, wave, attempt, countdown, enemy IDs, and surviving combatant records. Defeating the final wave calls the existing guardian-seal mechanism. Puzzle actions cannot bypass a survival trial, and guardian defeat and one-time treasure claims continue through the existing dungeon APIs.

Wave completion requires actual enemy defeats. An entity disappearing through streaming is restored from its saved record rather than counted as killed. Stuck or displaced wave enemies are moved to clear nearby ground with a visible reinforcement effect. Retreating and reentering retains wave health; the entry wrapper supplies the canonical dungeon checkpoint before the original entry method performs its save. A party defeat resets an unfinished trial. Previously solved cavern saves stay solved after upgrading.

The four `campDefense` quests are offered by the main regional NPCs in Greenfields, Stonecrest, Sunscar, and Emberworks. They use existing road posts and a separate `encounterRuns` ledger. Interacting with the camp bell starts three or four waves. The supply chest is a real combat target: enemy AI can choose it, projectiles and blasts reduce its integrity, and close melee strikes can damage it. A temporary target adapter is present only during combat processing and is excluded from snapshots. Integrity reaching zero, a party defeat, leaving the defense area, successful distant fast travel, or descending into a cavern fails the attempt. The bell or a fresh acceptance starts a new attempt; successful quest rewards use the normal completion ledger and are awarded once.

The four new demolition quests use existing authored `steps[]`: plant all three marked charges, then operate a distinct remote switch. `missionRuns` retains `placedCharges` and `detonated`. The remote checks every required charge ID before it can call the existing blast handler. The three explosions occur only at remote activation, and the spent switch cannot repeat them. Partial charge placement survives saves and dungeon visits. Quest arrows follow the next unarmed drive, then the remote switch. The earlier two demolition missions keep their original campaign behavior.

On-screen counters report wave number, remaining enemies, the break before the next wave, and camp integrity. World labels identify the altar, defense bell, armed charges, and remote interlock. Camp quests and survival caverns also have distinct journal type labels. NPC work menus use giver IDs and existing quest lists, so new assignments appear without replacing the authored conversations.

## Conversations and controller menus

`OW.Conversations` builds eight branching nodes for each of the 36 named contacts. Player replies and local progress inform subsequent lines and remembered relationships. Leads can mark a real cavern location. Dialogue memory is persisted independently of decorative NPC movement.

Menu navigation groups related controls before comparing their direction. Up/down can focus controls beyond a scroll viewport and scroll the relevant container to reveal them; left/right can move between groups. Nested lists remain traversable from top to bottom and back. Quest guidance uses the current objective, so the screen-edge arrow changes with mission steps and interior objectives. Simulated navigation tests exercise these behaviors; physical controllers and Bluetooth recovery still require target-device testing.

## Audio and assets

All included sounds and the score are original procedural compositions; no external music or sampled recordings are required. The live sound system makes weapon-specific effects, footsteps, interface sounds, wilderness ambience, and town chimes. Exploration, combat, and boss motifs switch with nearby danger, with short gain transitions. Separate music, effect, and interface sliders control their buses.

`assets/audio/manifest.json` lists the PCM WAV exports, and `assets/music/score.json` contains the original note motifs, tempo, chord progression, duration, and rendered track files. WAVs are mono, 16-bit, 22,050 Hz. The game synthesizes these motifs directly rather than downloading the exported WAVs at runtime.

The separate forge sprite is `assets/buildings/forge.png`; its generation prompt and provenance are recorded beside it. Use `config.assetBaseURL` consistently when referencing art. Image atlases need frame-level drawing; do not draw a complete sheet as an individual character. Retain alpha channels when preparing transparent sprite assets.

## Rebuilding exports and checking changes

From the project folder, optional developer commands are:

```text
node tools/regenerate-content.cjs
node tests/world-content.test.cjs
node tests/world-geography.test.cjs
node tests/world-navigation.test.cjs
node tests/world-steering.test.cjs
node tests/encounters.test.cjs
node tools/check-release.cjs
node --check js/world/world.js
node --check js/core/audio.js
```

The regeneration command updates the JSON catalogues, map exports, WAV effects, and music renders using `config.seed`. It does not change the original artwork. Run it after editing content or generation rules so exports stay in sync.

The world test verifies catalogue counts and unique IDs; mission targets and prerequisites; named target identities; courier route collision; safe defense posts and settlements; enemy footprints; all advanced enemy roles; streaming around separated players; activation limits; persistent wounds and defeats; save round trips; deterministic geography; and spatial searches. The geography test verifies expanded coordinates, planned road classes, cave trails, settlement details, legacy migration, and saved enemy scaling. The navigation test flood-fills the world at 40-pixel spacing, samples actual collision, and verifies that all named locations and enemy spawns connect to the starting camp after the Berlin gate opens. With encounter content loaded, the configured world has 248 named locations and 485 enemy spawns. The steering test checks that rifle, shield, heavy, and tank roles can pass the first headquarters with valid footprints.

`tests/encounters.test.cjs` exercises real enemy targeting and projectile damage against camp supplies, wave completion, failed attempts and retries, blocked early detonations, three remote blasts, one-time rewards, missing-entity restoration, partial health and charge persistence, travel/descent abandonment, and legacy solved-cave saves. Additional suites cover combat rewards, puzzle mechanics, conversations, and nested controller navigation. These are deterministic headless system tests. They do not certify physical controller models, Bluetooth recovery, audio hardware, or real display frame rates.

## Saves and compatibility

`world.exportState()` records defeats, liberated sites, discoveries, opened caches, location changes, persistent enemies, their regional scaling marker, and `coordinateScale`. `world.importState()` restores them. The game snapshot additionally saves both player profiles, inventory, skills, currency, armor progress, missions, conversation memory, reward drops, and map markers. Generic temporary reinforcements reset when restored. Active mission enemies and their remaining health are saved separately with escort/defense state. New camp waves store records in `encounterRuns`; survival waves use their cavern's `survival` state and canonical enemy checkpoint. Demolition charge IDs and the spent remote state remain in `missionRuns`. Dungeon snapshots preserve the overworld and return positions while retaining interior-local player positions in `activeDungeon`.

Saves predating the encounter module simply begin with an empty `encounterRuns` ledger. Existing solved, defeated, or claimed dungeon states are never reset when a puzzle site becomes a survival site. The saved campaign format stays at version 1, with new fields added alongside the prior data. NPC giver lists and the generated world are rebuilt from the current catalogue when loading, exposing the new assignments while preserving completed quest IDs.

`World.migrateSaveCoordinates(data)` converts older world positions by `1.3 / (savedScale || 1)` and marks the result, making repeated loads idempotent. It covers players, the reserve co-op hero, markers, mission runs, mission enemies, persistent world enemies, and discovered chunk cells while preserving IDs and non-spatial progression. Interior coordinates use their own space. `Game.restorePlayerPosition` moves a migrated hero off any newly blocking scenery to nearby clear ground. Local storage remains browser- and origin-specific; use export/import to transfer a campaign between hosts.

Keep the shipped seed for an ongoing campaign. If changing existing IDs, catalogue ordering, region geometry, or save structure, add an explicit migration before distributing that update. A static lobby can link directly to this folder's `index.html`; deployment and remote-art settings are described in `deployment.md`.

## Final combat balance

Charged weapons use their catalogue charge duration and a maximum twofold full-charge multiplier. Later regional bosses gain a health scale of 1 + 0.65 times their region index so high-tier gear still encounters their phase mechanics. Forge tuning adds Power, Rapid, and family-specific Tactical patterns, unlocked separately at firearm rank three. Reload timers clamp to zero after completion, including restored older saves.

## Berlin expansion (1.1)

Catalogue indices and existing IDs are preserved. Six enemies are appended at indices 30–35: jammer, stormcaller, duelist, hunter, bombardier, bulwark. The ninth boss is `Content.bosses[8]`; `boss_berlin` is its location and `boss_berlin_commander` is its enemy ID. `Content.sectors[0]` defines the Berlin rectangle and its west gate. It occupies part of region 7, retaining the original eight-region world grid.

`World.berlinUnlocked()`, `remainingMajorBosses()`, `majorBossesDefeated()`, `isFinalArena(x,y)`, `gateAt(x,y)` and `isLocationLocked(location)` govern access. Collision and streaming reject sealed arena positions; damage and area attacks also check this condition. `Game.completeBoss()` immediately records a commander victory independently of surviving guards. `campaignWon` is set only by the final boss victory, saved with the campaign, and validated against the final location on load. Legacy campaigns continue into this new finale.

Sixteen new quests use `steps[]`, whose actions are sabotage, recover, deliver, heal, scan, plant, detonate, activate, hold, repair, and report. Targets refer to real objective or NPC location IDs. Interact begins or completes an action. Scan channels are interrupted by nearby hostiles, damage, leaving, or losing their operator. Hold channels continue under fire while the operator remains present. Medkits and repair materials are spent by the interacting player. Delivery penalties apply to the carrier. `missionRuns` saves stepIndex, completedTargets, channel progress, and carry state; rewards use the same completion ledger as other quests.

Named resident profiles have dialogue, local/advice topics, and giver-linked personal quest IDs. All twenty bounty centers carry the same nine accurate posters. The Bounties menu and journal campaign status use actual boss defeat state.

Firearms now apply movement, recoil, heat, and spin accuracy tradeoffs. Shotgun pellets lose power over distance and apply knockback; piercing and ricochet rounds track hit IDs to prevent repeated hits on a single enemy. Melee stores a windup before resolving its cone, followed by a slowed, exposed commitment; the knife grants no dodge invulnerability. Both cats use measured torso and sleeve joints in the renderer, and projectile height is visual only.

Run `node tools/check-release.cjs` for every discovered test suite and JavaScript syntax checks. Navigation tests explicitly open Berlin before auditing every route; dedicated progression tests verify its locked state. `node tools/regenerate-content.cjs` refreshes readable catalogues, sector/poster metadata, overworld and cavern reference exports, and existing audio exports.


## Preview extension order (1.8)

`data/resistance-invasions.js` and `data/resistance-rewards.js` follow the previous content extensions. Early world installers `resistance-camps.js` and `resistance-fronts.js` register independent battle locations; the data exporter loads them too. `resistance-invasions.js` follows checkpoints and precedes normal quest turn-in. Reward, gear and art extensions follow the existing UI/discovery chain. The armor wardrobe follows resistance art so selected-hero previews can use its artwork. Ability upgrades, readable combat and guardian progression load last, in that order.

Game construction waits for DOMContentLoaded while the static deferred scripts execute. This ensures the renderer's asset list includes every late-registered armor and firearm image before image loading starts. A document already complete still boots immediately. The boot lifecycle regression covers both cases.

See `resistance-update.md`, `defense-update.md`, `resistance-rewards.md` and `ability-mastery.md` for behavior, migration details and verification limits.
