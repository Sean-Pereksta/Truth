# Hidden expeditions and personal co-op menus — 1.9 preview

This update adds three quest-exclusive armor suits, a freezing firearm, two rare-quest abilities, a new enemy, four distinct cavern routes, permanent dungeon keys, and independent personal menus for both heroes. Existing content and numerical catalogue positions remain intact.

## New expeditions and rewards

These are optional adventures with named contacts, explicit reward statements in their offers and journal entries, and fixed rewards for every eligible hero. Finish the dungeon, recover its expedition seal, and return to its contact. No random reward choice can take away these unique items.

| Expedition | Contact and location | Entry | Fixed reward |
| --- | --- | --- | --- |
| A Breath Beneath the Ice · level 12 | Keeper Thistle, Rimeglass Reservoir in Frostmarch; follow the frost-blue pipes from Warmhearth | Rimeglass Valve Key | Winter’s Whisper freezing carbine and permanent Frost Breath unlock |
| The Furnace That Wouldn’t Die · level 19 | Foreman Brindle, Cindercoil Foundry in Emberworks; follow the silent furnace chimneys from Ember Rest | Cindercoil Foundry Key | Ember Bastion Armor |
| The Wind Remembers · level 16 | Pilgrim Sora, Zephyr Reliquary in Reedwater; follow the wind bells from Reedlight Refuge | No key | Galeweave Mantle and permanent Aurora Well unlock |
| The Beast Beneath the Crown · level 26 | Diver Pearl, the Drowned Maw in Sunken Crown Isles; follow the shell markers east of Crownrest Haven | No key | Legendary Sea Beast Armor, after defeating Nacremaw, the Great Kraken |

The Rimeglass key is in the guarded Frozen Courier Cache in **Stonecrest**, east of Badger’s Lantern. The Cindercoil key is in the guarded Smuggler’s Tool Chest in **Reedwater**, east of Reedlight Refuge. Each has three real guards and no time limit. Both keys are permanent campaign items shared by the two heroes. Repeated interaction cannot duplicate them or consume access. Locked entrances and expedition guidance name the missing key and its clue.

The reservoir’s two lakes create a figure-eight with a safe middle crossing. The foundry’s two valve wings cool its central bridge. The reliquary’s offset terraces form a loop around a sanctuary. The Drowned Maw uses narrow tidal piers and three anchors before the arena. Each has distinct walkable floors, collision, mechanism positions and approach routes. Guardian arenas retain proven combat bounds so warning geometry and dodge space remain consistent.

Each interior also has original painted ground, background scenery and props: frost stone and reservoir pumps in Rimeglass; furnace grates, copper pipes and valves in Cindercoil; moss stone and wind bells in Zephyr; tidal stone, coral and shipwreck remnants in the Drowned Maw. Matching painted walls and corner stones follow exposed floor edges. They are drawn outside the playable routes, so decoration does not conceal doors, narrow a path or change collision. The art library’s **Dungeon scenery** collection presents the source artwork for all four themes.

## Equipment and powers

- **Winter’s Whisper:** 22 base damage, 3.2 shots/second, 12 rounds, 1.9-second reload and 800 range. Four accurate hits on one ordinary foe build a 1.1-second freeze, followed by four seconds of freeze resistance. Bosses are chilled; committed armored rolls retain their established behavior. The weapon has original artwork and painted trigger/support paws for both heroes and their outfits.
- **Ember Bastion Armor:** 28% armor and +60 health. Actual health damage readies two seconds of 20% additional damage reduction, with a 12-second recharge. Copper and obsidian plate with a crimson cape; no healing or permanent immunity.
- **Galeweave Mantle:** 18% armor and +36 health. A completed reload readies the next shot or shotgun volley for +20% damage within three seconds, and gives +15% walking speed for two seconds. Eight-second recharge. Ivory, emerald and teal suit.
- **Sea Beast Armor:** 30% armor and +85 health. **Kraken’s Grasp** rewards three separate firearm hits on the same foe with a 40-base-damage spectral tentacle strike, scaled by hero level, and 1.5 seconds of chill; six-second recharge. **Tidal Escape** leaves a small ink pool for two seconds after a dodge that chills ordinary foes; ten-second recharge. Its original artwork includes oversized pearl shell spikes, dorsal fins, luminous suction cups, scaled boots and a curling purple tentacle mantle.
- **Frost Breath:** three 18-base-damage pulses through a 270-range cone, with hero/Tactics damage scaling and an 18-second base cooldown. The pulses build frost; walls and campaign barriers stop the effect. Earned only through the Rimeglass quest.
- **Aurora Well:** a four-second, 165-radius sanctuary. Living heroes and allies inside recover 6% of maximum health per second, capped at 24% per full cast; slowing chill is removed. It cannot revive fallen actors, heal through walls, or stack overlapping wells. Twenty-four-second base cooldown. Earned only through the Zephyr quest.

The two new abilities cannot be purchased with skill points. Quest completion permanently unlocks them for each active, resting or subsequently joining hero. Level requirements still apply. Existing learned powers, points, ability ranks and cooldowns are preserved; equipping or moving an ability between slots cannot reset its cooldown.

All three armor rewards are complete suits in the existing armor slot. Their distinctive bonuses do not require extra pieces. Existing outfit reinforcement still applies. Inventory → Armor shows the new suits, artwork, comparisons and quest clues. Unique rewards arrive in each hero’s pack without changing their equipped loadout.

## Enemies and the great kraken

**Prism Sentries** lock two cyan frost lanes before firing, leaving a visible gap. Stun or freeze can interrupt the charge. Their recovery exposes the prism backpack. They appear in the new guarded expeditions and key caches, with bounded, reachable spawns and original illustrated poses.

**Nacremaw, the Great Kraken** is an optional level-26 challenge in the Drowned Maw. It has **48,000 health solo or 72,000 for a two-hero encounter**, with party scaling recorded once. Its **190 base damage** is adjusted by attack and health phase. Three health phases expand from tentacle lashes, targeted slams and ink fans to expanding undertow waves and a combined maelstrom. Threats are committed and visibly warned; expanding waves have marked escape gaps. Its shell admits **20% of direct hit damage** outside recovery; exposed recovery takes **125% of direct hit damage**. Warnings begin at least 1.15 seconds before impact, and recovery lasts 2.1 seconds in the first two phases or 1.6 seconds in the final phase. There is no overall kill deadline. Attack effects and projectiles are capped, and an attack is cancelled if its warning cannot be shown.

Painted tentacles, splashes, ink orbs, foamy waves and a vortex accompany the kraken’s attacks. Their animation follows the existing combat events; the warning shapes and escape gaps remain the authoritative danger indicators. Sea Beast Armor uses the matching painted grasp and ink effects.

Saving and leaving preserve an injured kraken’s health and the encounter’s party scaling. Reloading cancels queued attacks and gives a short recovery instead of resuming an invisible strike. Defeat retries reset the failed attempt; a defeated kraken and a recovered seal stay completed. Rewards require the quest’s normal turn-in.

## Two-player menus

Each active hero owns a separate Inventory/Skills panel with independent selections, tabs, scrolling, focus and equipment/learning actions. Both panels can be open at once. Neither panel can retarget its actions to the other hero. Combat pauses while either personal panel is open, and resumes when both close.

Shared Camp/Settings menus suspend the personal panels and restore them on return. Each hero’s equipped guns, armor, abilities, passive training, upgrades and cooldowns are saved independently, including a resting co-op hero. Opening an overlay is temporary UI state; it is not restored over gameplay after loading.

## Saving and validation

Browser save keys remain unchanged. New item, enemy, ability, quest and cavern entries append to the existing catalogues. Optional validators check new keyrings, guarded cache records, expedition state and per-hero claim ledgers before restoring a campaign. Older saves without these fields remain valid. Invalid new fields must not replace the last good save or partially clear the live campaign.

Final automated results are recorded in `test-results.json`. Focused suites cover real ability and projectile behavior, menu actions, controller routing, quest rewards, key gates, route connectivity, boss warnings/damage, repeated saving/loading, resting heroes, storage failure and failed Continue preservation.

Original generated PNG sources and measured crops live in `assets/expeditions/`; the [art gallery](../art-gallery.html) opens on the new equipment, ability, creature and kraken-effect sheets. The [asset manifest](asset-manifest.md) identifies the runtime art and its metadata. Offline renderer previews and layout diagrams are provided. Live browser appearance, physical controllers and target-device performance still require human acceptance playtesting; the earlier computer-use tool could not reliably access the preview, and no bypass was attempted.
