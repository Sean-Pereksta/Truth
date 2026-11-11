# 1.9 preview acceptance status

All **71 automated suites passed**, and all **68 runtime JavaScript files passed syntax checks**. All 76 script and stylesheet references in the game entry point resolve locally. The complete results are in `test-results.json`.

The new coverage includes real quest rewards and all three armor bonuses, the freezing firearm, rare ability behavior and effect-pool exhaustion, separately owned co-op inventory/skills panels, permanent keys, four distinct dungeon layouts, Prism Sentry attacks, Nacremaw's five attack types and three phases, and production-order save/load preservation. Invalid Continue and rejected snapshots preserve the live campaign and the prior valid save. Resting heroes, separate loadouts, injured guardians, key guards and one-time claims are covered.

All four illustrated interiors were rendered through the actual terrain code and inspected, including painted floor textures, backgrounds, transparent props, measured wall art, readable mechanisms, sealed/open gates and the cooled foundry bridge. The actual game renderer also produced staged Kraken previews with both heroes, painted tentacle strikes, ink projectiles and foamy undertow waves. These are offline native Canvas previews; they do not constitute a live browser or physical-controller playthrough. Target-device performance, complete campaign balance and human difficulty remain acceptance work.

The Kraken combat simulation completed in 60 seconds solo and 46 seconds co-op using ordinary level-26 gear and automated reactions to visible attacks. This helped tune encounter duration and exercise all phases; it is not a measurement of human difficulty. Reports are in `kraken-balance-before.json` and `kraken-balance-after.json`. The release guide is `expedition-update.md`.

---

The full run found one legacy discovery test whose simulated document lacked the new co-op panel support. That fixture was updated while preserving solo coverage, and a separate co-op regression exposed and fixed a stale discovery overlay identifier. Discovery, co-op menu, expedition persistence and save-UI suites then passed targeted reruns; the corrected runtime passed a fresh syntax check. The results preserve the initial failure and rerun evidence.

# 1.8 preview acceptance status

All **60 automated suites passed**, and all **52 runtime JavaScript files passed syntax checks**. This includes the new armor wardrobe, quest-exclusive reward rules, painted weapon attachments, ability upgrades, defenses and invasions, regional guardian progression, and legacy campaign saving. The final report is `test-results.json`. Separate encounter simulations completed all 20 defense and all six invasion solo/co-op scenarios.

The latest change list and limitations are in `resistance-update.md`; automated results are in `test-results.json`. Defense and invasion combat simulations are separate from human acceptance testing. Live browser visual/controller checks were not completed because the computer-use service could not reliably identify the Windows browser URL. The report below is historical evidence for the preceding release, not a new visual acceptance result.

---
# Campaign save reliability verification · 1.7.1

All **49 suites passed**, and all **40 runtime JavaScript files passed syntax checks**. The final complete run is recorded in `test-results.json`. Three new suites contain **44 save checks**: 19 storage checks, 17 real UI/controller-handler checks, and eight full-production-script-order Continue checks.

The reported older-progress symptom was reproduced in the installed 1.7.0 logic: persist a campaign, reject subsequent storage writes, change the hero's gold, save, then Continue or Export. Both read the older persistent copy despite the newer in-memory snapshot. The repair selects the newest valid available copy, verifies primary writes by reading them back, retains a previous valid copy when possible, and uses session storage for additional temporary recovery. Per-slot status distinguishes permanent, session-only, failed and unavailable saves, with timestamps and explicit older-backup recovery notices.

Regression coverage includes rejected and silently discarded writes, blocked reads, same-tab reloads, failed session retention, restored storage access, fast successive saves, later writes from another runtime, corrupted primary copies, backup failure, invalid and cyclic snapshots, serialization round trips, old import formats, invalid slots and safe exports. Actual UI handlers check truthful Save and Save & return to title messages, persistent warning text, controller activation, import/load failures, asynchronous import slot changes, and explicit confirmation before replacing a corrupt campaign.

Failed Continue no longer falls through to new-game creation. Checks preserve the active heroes, quests, mission and defense state, checkpoint, discoveries, armor powers, active dungeon, surface return state, slot and stored bytes. Injected read failures at every load layer verify rollback without partial saves. Successful dungeon Continue, co-op, armor and pending discovery restoration remain covered, alongside all prior gameplay suites.

The user's browser and its stored campaign were not directly inspected, so recovery of already-lost progress is not claimed. Tests simulate browser storage behavior and execute the shipped game and UI handlers; no new full browser or physical-controller playthrough is claimed. Existing game files were backed up before installation, and browser save keys and campaign format remain unchanged.

---

# Deep-region hunters, masterwork armor and discoveries · 1.7.0

All **46 suites passed**, and all **40 runtime JavaScript files passed syntax checks**. The complete release run is recorded in `test-results.json`, with a final targeted discovery rerun after the last deferral fixes. All 25 discovery checks passed in that rerun.

The Blackglass Reaver and Cinder Mortar Rat have distinct illustrated attacks and 24 deterministic placements across four deeper regions. Tests exercise their actual AI with the complete production script order and real terrain. Coverage includes fixed circular blade paths and matching warnings, outward/return hit limits, projectile reflection, thin-wall collision, four mortar landing marks, three high rebounds, interruption cleanup, co-op targeting, persistence and checkpoint resets. Existing encounters and original spawn identities remain intact.

Three forge-only armor sets add different playstyles: Stormrunner dodge reloads and charged shots, Bastion directional bracing and empowered melee, and Spellweaver shorter ability cooldowns with a temporary ward. Tests verify crafting costs and unlocks, independent co-op ownership, equipment requirements, damage and cooldown changes, state expiry and cleanup, no healing through armor swaps, and exclusion from ordinary loot and shops. All 48 armor poses and 16 new enemy poses have measured artwork mappings and fallback coverage. The real renderer produced six enemy scenes and 36 armor examples for visual inspection, including both cat appearances, weapons, facing directions, dodging and downed poses.

Equipment discoveries now retain a per-hero receipt until acknowledged, show artwork, rarity, source, comparison and direct equipment choices, and defer the full reveal during danger or other menus. Checks cover save/load, existing-save migration, duplicate prevention, shared rewards, controller and keyboard handlers, level requirements, input guards, unclaimed caches, hidden quest receipts, ownerless hazards, and defense-wave countdowns. Existing reward payouts remain one-time transactions.

No current full browser campaign, physical-controller or audio-hardware playthrough is claimed. Browser preview was blocked by the available browser's local-file security policy; that restriction was not bypassed. Native Canvas inspection validates renderer output, and handler tests validate interaction logic, but neither replaces a full browser and hardware playthrough. Earlier reports below describe their respective releases.

---

# Illustrated abilities and dialogue verification · 1.6.0

All **38 suites passed**, and all **31 runtime JavaScript files passed syntax checks**. The complete final release run is recorded in `test-results.json`.

New coverage includes ten combat response checks, nine equipment-menu checks, nine dialogue integration checks, eighteen quest turn-in checks, and five spell-rendering checks. These exercise production gameplay and actual UI action handlers: short recovery buffers, expiry and scene cleanup, attack priority, real equip/buy requirements, independent co-op loadouts, stable focus after learning/using/equipping, compact conversation choices and back navigation, keyboard Enter/Tab handling, explicit offers, reward receipts and repeated claims.

Quest regressions cover objective-ready saves, legacy completed saves, correct-recipient and range validation, dungeon exit guidance, final reports and deliveries, automatic pure-conversation completion, multiple receipt queues, coastal equipment and fully-owned salvage rewards, prevention of defense restarts, downed co-op allies during reward level-ups, and immediate final-boss victory with a deferred quest bonus.

All 24 menu paintings map to distinct valid cells in the two bundled atlases. Twelve transparent spell sprites have populated artwork and genuine transparent gutters. Rendering checks cover bounded source rectangles, finite geometry, depth layering, original-effect fallback, portable/CDN asset paths, accessible labels and unchanged gameplay effect data. Six real ability casts were rendered with the game's renderer on native Canvas and visually inspected; the revival crystal was moved behind its caster to preserve readability.

No current full browser campaign, physical-controller or audio-hardware playthrough is claimed. Compact 320 × 480 menu layout was reviewed in markup and CSS, with interaction behavior tested through the actual handlers. Native Canvas images validate the world renderer, not browser DOM layout. Earlier test reports below describe their respective releases.

---

# Coastal expansion and checkpoint verification · 1.5.0

All **33 suites passed**, and all **25 runtime JavaScript files passed syntax checks**. `test-results.json` records the complete release run, including the earlier combat, controller, audio, branding, quest and item regressions.

The expansion adds two connected, textured regions, three safe settlements, six NPC quest contacts, six linked exploration quests, and six defense missions containing 27 authored waves. Region checks verify access from the existing world without the Berlin gate, stable original coordinates, objective accessibility, new scenery, quest prerequisites and NPC-only acceptance. Defense checks exercise every wave plan, camp damage from all four new enemy types, retries, persistence, six actual mission completions and one-time equipment choices.

Checkpoint checks cover last-visited refuge persistence, old-save migration, solo defeat, total party defeat, a single downed co-op player, save/load while downed, dungeon cleanup, full enemy-health restoration, interrupted revival and protection against healing through travel or shops. Harpoon checks verify actual player displacement after a landed hit, a 210-unit limit, collision and line-of-sight stops, the immunity window, dodge and source interruption, pause behavior and cleanup on defeat or world travel.

Artwork checks validate 23 PNG sheets and 204 frames. New rendering checks cover all 32 enemy poses, actual attack states, four terrain quadrants, shoreline clipping, water patterns, eight scenery props and missing-art fallbacks. The game's renderer was also run against a native Canvas implementation; region, combat and co-op revival images were inspected directly. These are offline renderer inspections, not a browser playthrough or physical-controller/audio-hardware test. Full campaign balance still requires playtesting.

---

# MeowQuest title and creature audio verification · 1.4.1

All **28 suites passed**, and all **19 runtime JavaScript files passed syntax checks**. `test-results.json` records the complete release run and the targeted animal-audio rerun after the final species correction.

The new audio suite contains sixteen checks against the runtime and actual gameplay methods. Coverage includes the sixteen embedded WAV files matching their bundled originals, valid non-silent PCM data, event variation and cooldowns, injury and defeat timing, distance and stereo position, muted/paused/suspended guards, a three-voice limit, species-correct guardian and brood behavior, state-change calls, scene cleanup, asynchronous decode teardown, unsupported-clip resilience, NPC greetings, medicine, and both revival paths. Audio events are verified with a Web Audio test double; this is not a speaker or headphone listening test.

Branding checks verify the exact accessible game title, one visible artwork title, offline and CDN cover paths, retained campaign controls, layout rules for an uncropped cover and stacked narrow-screen menu, and the PNG structure and dimensions. The original generated cover was inspected directly. Save keys, content IDs, and campaign data retain their prior values.

No current browser playthrough or physical-controller/audio-hardware pass is claimed. Interactive verification remains unavailable after the earlier local-preview connection failure and Computer Use URL-policy stop; `browser-check-results.json` distinguishes those limits from the earlier 1.3 browser checks.

---

# Harder resistance verification · 1.4

All 26 suites passed, and all 18 runtime JavaScript files passed syntax checks. The current automated results are in `test-results.json`. The release runner discovers every test and checks all runtime JavaScript syntax. New regressions cover aggressive melee pursuit, distinct commander pressure attacks, damage scaling, ricochets against walls/corners/thin obstacles, sustained guardian rolls, armor mitigation and save refresh, single-choice reward persistence and deduplication, ability visuals, controller purchase focus, NPC-only quest acquisition, next-contact handoffs, and the dungeon exit/re-entry input guard.

Browser visual verification for 1.4 could not be completed: the in-app browser could not reach the local preview, and local Computer Use stopped because it could not determine the current browser URL confidently enough to enforce policy. No visual playthrough or physical-controller pass is claimed for 1.4. The reports below describe the previous 1.3 release only.

---

# Illustrated encounters verification · 1.3

## Automated validation

**Final release result: all 23 suites passed; all 18 runtime JavaScript files passed syntax checks.**

Run `node tools/check-release.cjs`. The dependency-free runner discovers all test suites and checks runtime JavaScript syntax. Exact results and individual check output are recorded in `test-results.json`.

The expansion validates 17 original PNG sheets and all 160 populated source frames, true alpha transparency, portable paths, crop containment, stable actor anchors, complete fencer blades, and fallback rendering. Actor and dungeon render tests cover illustrated enemies, guardians, floor materials, puzzle devices, luminous beam paths, mission props, and wave overlays.

Guardian simulations exercise every new attack, all three health phases, committed charge targets, separate chain warnings, actual expanding-ring damage, timed ice strikes, poison and web hazards, active brood enemies, burrow eruptions, arena wards, pause behavior, save restoration, and threat cleanup after death. A pooled-effect reuse issue discovered during web hazard checks was corrected.

Encounter tests cover survival waves, camp integrity under real AI and projectiles, enemy-health persistence, abandonment and retries, planted-charge persistence, the three-charge remote interlock, three separate blast sites, and one-time mission rewards.

Skills and loot checks cover all 24 catalogue entries; point purchases; locked equip, cycling, and casting paths; two independent hero profiles; migration of older saves; cooldowns retained through slot changes; actual movement, shield absorption, freezing, projectile reflection, recurring gravity damage, poison impacts, gunfire timing, resource sharing, revival, blade-path hits, and grappling collision. Ordinary, elite, and summoned archetypes are checked for the absence of equipment drops. Rare equipment remains tied to concrete commander, named-target, or cavern sources.

Earlier coverage remains active for full controller traversal, 36 authored NPC conversations with 288 nodes, fullscreen controls, quest guidance, planned roads, coordinate migration, regional combat scaling, shops, armor functions, campaign victory, world navigation and streaming, all four puzzle mechanisms, co-op transitions, and persistent one-time relic claims.

## Browser validation

The game and art library were inspected in the Codex in-app browser. Temporary scene controls lived outside the delivered game. Final tests used a separate local origin from the user's running preview.

- Reviewed the revised roller attack pose and complete fencing blade in the animated art library.
- Inspected illustrated mirror hardware, exact beam direction, architectural props, guardian arena, floor textures, and dungeon minimap.
- Inspected survival and camp-wave counters, camp supplies and barricades, and the revised outdoor HUD placement.
- Planted all three demolition charges through the real objective method and used the remote interaction; observed detonation, completion, and rewards.
- Learned Dashstep through Skills, observed the balance decrease from 20 to 19 test points, equipped it as primary, saved, and restored the learned power, slot, and point balance.
- Sent repeated controller actions through the long Skills catalogue: downward navigation reached passive training at about 4,366 pixels of scroll; upward navigation returned through clipped cards to the first rows before wrapping through the other menu controls.
- Inspected Gravelback's faultline-slam warning and expanding ring, rock-fan warning, and separately labeled chain-roll warning.

An initial temporary boss-test shortcut attempted entry before moving its test hero to the entrance. The game correctly refused entry; the shortcut was corrected. This helper is excluded from the release.

## Practical limits

These are automated behavior checks and selected browser flows, not a complete manual campaign balance playthrough. Physical controllers, Bluetooth reconnection, and every display size still require testing on player hardware. Simulation timings do not certify rendered frame rate. Existing save IDs and item indices remain stable, with explicit progression and coordinate migration.


