# MeowQuest the Purr’d Reich

An original, illustrated open-world resistance action RPG for one or two local players. Explore ten connected territories and the Berlin Sector, defeat all eight regional commanders, then confront Adolph Whisker to win the campaign.

## Faster regional enemy progression

Regular enemies gain health and damage much faster after Greenfields. Campaign health multipliers now rise through **1, 2.2, 4, 6.6, 10.2, 15.2, 22 and 31**; damage multipliers rise through **1, 1.8, 2.8, 4.2, 6, 8.4, 11.5 and 15.5**, in addition to existing enemy-level bonuses. Blackbanner patrols have about twice their previous health and 89% more damage. Stormglass Coast uses **8.9× health / 5.4× damage** and Sunken Crown uses **15.2× / 8.4×**, matching their level-12 and level-16 side routes.

Existing ordinary enemies adopt the new health curve when activated in combat, preserving their remaining health percentage. Saves and checkpoints retain the applied multiplier so loading or retrying cannot stack it. Authored defense waves, invasions and guardian health keep their own encounter budgets.

## Hidden expeditions and personal co-op menus · 1.9 playable preview

- **Four optional expeditions:** explore Rimeglass Reservoir, Cindercoil Foundry, Zephyr Reliquary and the Drowned Maw. Two guarded keys permanently open their matching vaults. Recover each expedition seal and return to its named contact for a fixed reward.
- **Quest-exclusive equipment:** Winter’s Whisper builds frost with accurate shots; Ember Bastion braces after injury; Galeweave rewards a completed reload; legendary Sea Beast Armor summons a grasping tentacle and leaves ink after a dodge. Original illustrations show the complete suits on both heroes and painted paws gripping the new firearm.
- **Two earned powers:** Frost Breath sends three icy cone pulses; Aurora Well heals living allies inside its sanctuary. Their quests unlock them for active, resting and future co-op heroes without spending skill points or changing equipped abilities.
- **New encounters:** Prism Sentries warn before firing paired frost lanes. The optional Great Kraken has three phases, five attacks, a protective shell and exposed recovery windows. Its encounter has no overall kill deadline.
- **Painted dungeon surroundings:** each expedition has its own ground textures, background scenery and themed props. Ice-covered stone, copper and obsidian masonry, mossy ruins and barnacled seawalls frame the walkable routes; painted kraken effects accompany its attacks while clear warnings mark danger.
- **A personal screen for each hero:** both players can open Inventory or Skills together, with separate selection, controller focus and loadouts. Combat pauses while either personal panel is open. Saves retain each hero’s gear, skills, upgrades and cooldowns, plus permanent keys and expedition progress.

See [the expedition guide](documentation/expedition-update.md) for contacts, key clues, exact effects, saving behavior and acceptance limits; [the art library](art-gallery.html) opens on the new collection. Existing campaign save keys and catalogue positions are preserved. Automated checks and renderer previews accompany this preview; live browser appearance, physical controllers and target-device performance still need acceptance playtesting.


## Resistance update · 1.8 playable preview

Clearer 45-second road holds, revised camp pressure, a moving counterattack, three staged invasions with useful resistance allies, three hidden adventures, three illustrated guns with painted gripping paws, two quest-exclusive armor suits and an illustrated armor wardrobe. Five abilities gain upgrade ranks, Fencers have clearer counterplay, Ironhide rolls are 13% shorter, and deeper cavern bosses gain stronger attacks and larger move sets. Existing campaign keys and catalogue indices are preserved.

Start with the playable-slice checklist and the exact reward locations, ability values, compatibility evidence and remaining acceptance work in **documentation/resistance-update.md**. This is a preview: automated checks and combat simulations are included; physical-controller and full browser visual acceptance remain outstanding.
## Campaign saving repair · 1.7.1

- **Continue uses the newest valid copy.** A failed browser-storage write can no longer make an older disk save hide newer progress held in the session. Export uses that latest progress too.
- **Honest save feedback:** Save campaign, autosave, and Save & return to title distinguish a permanent save from session-only progress or a failure. Title and pause screens show the saved time. If the screen says **Only in this tab**, use **Settings → Export campaign** before closing the game.
- **Recovery copies:** successful writes are checked by reading them back and retain a previous valid copy when storage permits. Temporary progress also uses session storage when available, so a same-tab reload can recover it. Recovery from an older backup is identified explicitly.
- **Failed Continue is safe:** an unreadable or unavailable save no longer starts a new campaign over the slot. Invalid imports and snapshots leave previous saves intact.

Existing campaign keys and backup formats are unchanged. Keep opening your existing game copy; the upgrade does not move or erase browser saves. See `documentation/save-recovery.md` for save status and backup help.

## Deep-region hunters and masterwork armor · 1.7

- **Treasure celebrations:** finding a new firearm or armor creates a saved discovery receipt. A small notice appears during danger; once the area is clear, a larger illustrated celebration shows the source, rarity, stats and fighting style, with **Equip**, **Equip backup** or **Keep in pack** controls. Each co-op hero chooses independently.
- **Three wearable masterworks:** Stormrunner Harness loads two reserve rounds on a dodge and empowers the next shot; Bastion Bulwark trades movement speed for a frontal brace and stronger counterattack; Spellweaver Mantle shortens ability cooldowns and grants a temporary ward while reducing firearm damage. Each changes the orange or white cat's appearance through eight animated body poses. Forge patterns unlock after 2, 4 and 6 commanders, with one-time gold, scrap and rare-core costs for each hero.
- **Blackglass Reaver:** an agile obsidian-armored rat throws paired crescent blades around broad curved paths, marked by violet warnings. The blades circle back, threatening a second hit; attack during its exposed catch.
- **Cinder Mortar Rat:** a brass-backed artillery rat marks four landing points and fires a high arcing shell that rebounds three times before leaving a burning crater. Each bounce rises visibly before falling again. Keep moving, then punish its long reload.
- **Original graphics:** both enemies have eight painted animation poses, visible attack effects, and the existing varied rodent combat sounds. Firing, recoil, catching, injury and recovery use their own artwork.
- **Deeper encounters:** 24 new enemies form roadside and installation pairs across Emberworks, Blackbanner Citadel, Stormglass Coast and Sunken Crown Isles. The game now has 50 regular enemy roles. Existing saves and liberated outposts remain compatible.

Reload at your usual game address to play the update. All new artwork is included for offline play.

## Spells, conversations and rewards · 1.6

- **24 painted ability illustrations** replace the line diagrams in Skills and equipped ability slots. Twelve new transparent effect sprites bring crystalline barriers, frost spikes, gravity swirls, mirrored facets, healing beacons, orbiting daggers, poison needles and grappling hooks into combat.
- **Direct equipment controls:** every inventory card has its own Equip or Use button; firearms offer primary and backup slots. The loadout summary shows what each hero carries. Filters, comparison details, learned powers and controller focus remain stable after actions.
- **Compact conversations:** interact with a cat to open a portrait and reply choices. Ask about a job to see its offer; ordinary conversation does not open the full field manual. Authored stories, advice, local services and back navigation remain available.
- **Bring completed work back:** after completing an objective, follow the arrow to the named recipient and choose **Finish quest**. A check-mark crest identifies the waiting cat. The reward celebration shows earned currencies, equipment choices and the next contact. Reports and deliveries finish at their recipient; a pure speaking assignment finishes during that conversation. Existing completed quests remain completed and cannot pay twice.
- **More responsive combat:** a 140 ms input buffer preserves dodge, spell, grenade and melee presses near the end of recovery. Attack commitments and cooldowns still apply. Actual landed hits produce short, restrained impact sparks, with no pause to enemy simulation.

Reload the game at your usual address to retain your current saved campaign. New illustrations are bundled for offline play; no asset download is required.

## Tides of resistance · 1.5

- **Two new connected regions:** travel east from Frostmarch to Stormglass Coast (recommended level 12), or east from Sunscar to the Sunken Crown Isles (level 16). Follow the causeway between them. Three safe settlements, six named NPCs, six exploration/rescue/sabotage assignments and six wave-defense missions await. The original campaign remains intact.
- **New textures and scenery:** coastal heath, shingle beaches, mossy island paving and lagoon water accompany lighthouses, storm bells, shipwrecks, glowing beacons, ancient arches, cat statues, sea-chests and windswept shrubs.
- **Four illustrated enemy types:** Harpoon Skirmishers drag you toward them with a landed spear; Tempest Bellringers call three delayed storm strikes; Shellguards protect their front and expose themselves after bashing; Tideblades feint sideways and follow with two knife strikes. Each has eight original animation poses and distinct attack warnings.
- **Six authored defenses:** 27 escalating waves protect beacon stores, rescue camps, causeways and evacuation piers. Speak to each quest giver, then ring the marked camp's bell. Enemy mixes, wave names, reinforcements and co-op squad sizes vary. Success grants gold, experience, scrap and cores once; the two regional finales offer one shared equipment choice, including the new Stormglass Breakercoat or Crownrest Tide Charm.
- **Latest-checkpoint recovery:** visiting a refuge or liberated outpost activates it. Solo death or a complete co-op defeat returns the party there and restores surviving enemies' health and attack states. A living co-op partner can revive a fallen fighter with E / B nearby; stay close to fill the visible progress bar. Moving away, attacking, taking damage or being dragged interrupts revival. One downed fighter does not trigger a party respawn. Checkpoints and downed states persist across saves.

The expanded world has **10 regions, 149 quests, 48 regular enemy roles**, and the same nine campaign bosses. Old coordinates, campaign IDs and save keys remain stable. Reload at your existing game address to use this update.

## MeowQuest comes alive · 1.4.1

- A large illustrated **MeowQuest the Purr’d Reich** title cover greets you, with campaign controls beside it on wide screens and below it on smaller screens.
- Sixteen varied animal clips add cat greetings, meows, purrs and hisses, plus mouse and rat-style squeaks during nearby encounters, combat, healing and revivals. Calls vary in pitch, avoid immediate repetition, fade with distance, and follow the **Sound effects** volume setting. Up to three animal voices can overlap.
- All sounds are included for offline play. The CC0 recordings and sound imitations are credited in `assets/audio/animals/SOURCES.md`; the title cover is original generated artwork.
- Existing campaigns retain their save keys and progression. Reload the game at the same address to see the new title and hear the new sounds after your first click or controller action.

## Harder resistance · 1.4

- Regular enemies deal 80% more damage in the opening region, tapering to 40% more in the deepest region. They move and fire faster, lead moving targets, and knife fighters keep pursuing after leaping. Hit protection is shorter.
- Every commander now maintains a distinct pressure attack between faster specials. Cavern guardians have tighter warnings and shorter openings. Ironhide rollers and Gravelback roll faster and longer, ricochet off walls, and can hit along their entire travel path.
- Commander, named-target and cavern caches offer **one equipment choice**, shared with both heroes, instead of granting a batch. B backs out without losing the cache; interact again to choose later. New equipment receives a large acquisition banner. Existing equipment and old uncollected drops remain intact.
- Armor gives substantially more protection and health; reinforcement adds 12 health and 2.2 percentage points of protection per rank. Combined armor and survival protection caps at 72%. Saved equipped items use their current balanced stats.
- All 24 abilities have distinct illustrations alongside their icons and visible combat effects. Skills categories support LB/RB browsing; learning and repeated training purchases keep controller focus on the relevant action.
- Interaction happens once per press. Dungeon transitions also briefly block a second interaction, preventing an exit from immediately re-entering.
- New assignments must be accepted in conversation with their named NPC. Large golden exclamation marks identify available contacts. The journal can mark a quest giver, and completed missions point to the next available contact. Already accepted saves remain playable.

Reload the page to use this update. Browser saves remain at the same file/hosting address; use Export save before moving to a new address.

## Illustrated encounters · 1.3

The eight new enemy types and four cavern guardians now have dedicated illustrated animation sheets. Caverns use coordinated floor textures, architectural props, puzzle devices, light effects, and encounter objects. Rolling, teleporting, fencing, and elemental attacks retain visible warnings and recovery states; puzzle symbols and interaction labels stay readable over the artwork.

Four caverns now contain survival trials, and eight new NPC assignments add camp defenses and remote demolition jobs. The campaign contains **137 quests: 25 main missions and 112 optional assignments**. All 16 cavern entrances remain available, with 12 puzzle chambers and four survival chambers leading to their guardians and relics.

The rebuilt **Skills** screen offers **24 active abilities**, two equipped slots, and six passive training branches. Twelve new powers are learned with skill points. Ordinary enemies drop scrap and supplies; special equipment belongs to commanders, named targets, and cavern rewards. All four cavern guardians now rotate multiple attacks through three health phases.

## World and combat

- Explore an **18,720 × 14,560** world: 69% more land area, planned caravan roads and valley routes, short settlement approaches, and marked cave trails. Villages have paved squares, markets, wells, gardens, lamps, and organized homes; occupied camps have supply yards and military equipment.
- Enter **16 caves** with puzzle or survival chambers, sealed guardians, and relic rewards. In puzzle chambers, read and shoot rune sequences in order, rotate mirrors to direct a reflected beam, connect water pipes, or solve a constellation where each shot toggles a star and its neighbors. Incorrect rune shots reset the sequence.
- Fight four cavern guardian families: an armored rolling rat, an ice-winged bat, a venomous spider, and a burrowing king. Sixteen vault quests follow the puzzle or survival, guardian, and treasure stages. Chamber progress and dungeon visits survive saves.
- Discover **53 firearms** and **six functional reward armors**. Quartermasters carry small regional selections of basic gear; unusual weapons come from commanders, named reward encounters, and cave guardians. Ordinary troops and beasts drop scrap, ammunition, medicine, and currency. Fire, stacking poison, freezing, enemy-to-enemy ricochets, multi-shot bursts, piercing rounds, and splash explosions create different fighting styles.
- Face **44 regular enemy roles**, including armored rolling mice, teleporting stalkers, lunging fencers, burrowing rats, and regional beasts. Rollers reflect shots while rolling and expose themselves during recovery. Deeper regions increase enemy strength substantially.
- Talk with **36 named NPCs across 288 branching conversation nodes**. Replies affect remembered conversations and reveal local stories, advice, and leads.
- Navigate complete nested menus with a controller: moving up or down reaches items outside the current scroll view. Tracking a quest adds an arrow at the screen edge toward its current objective.

Existing campaign IDs and equipment remain compatible. Saved world positions, quest events, markers, and discovered terrain migrate to the expanded map; newly blocked player positions are moved to nearby open ground. Reload the game page after replacing its files.

## Previous Berlin campaign upgrade · 1.1

- Gun sleeves attach at the shoulders across both cats, all three outfits, movement, recoil, reloads, and aiming directions. Shots and muzzle flashes follow the raised weapon height.
- Opening Orchard camps contain three or four guards; Mosswood camps contain four or five. Patrols are more spread out, with distinct warning tells and specialist attacks.
- Six new enemy roles join the roster: Signal Jammer, Storm Caller, Blade Duelist, Wire Hunter, Cluster Bombardier, and Citadel Bulwark.
- Sixteen named resident cats offer sixteen authored missions with multi-stage objectives: disconnect alarm relays, carry and deliver supplies, treat wounded cats, record intelligence, plant and detonate charges, repair machinery, restore radio links, and protect broadcasts. These actions require their actual objectives; killing more enemies does not substitute for them.
- Quest cards show an hourglass when accepted and a green checkmark when complete. Cats offering a new available quest glow softly. Completed personal requests remain visible in conversations.
- Navigate menus and conversations with the D-pad or left stick, select with A, go back with B, and change tabs with LB/RB. Start opens or closes the current menu.
- Twenty bounty centers display posters for all nine bosses, with locations, tactics, map markers, and defeat status. The mission journal also tracks your eight commander victories and Berlin access.
- Every regional boss rotates three signature patterns with three health phases. Adolph Whisker waits inside the Berlin Sector at the northeast corner of Blackbanner. His four phases combine teleports, dash chains, artillery, rockets, precision volleys, expanding attack rings, hazards, and elite reinforcements. His 42,000 health and recovery windows reward careful preparation and deliberate attacks.
- Berlin blocks entry, projectiles, and area attacks until all eight regional commanders are dead. Killing a commander counts immediately, even if guards survive. Defeating Adolph Whisker wins; surviving guards and optional quests remain available afterward.
- Gun families now have stronger movement and accuracy tradeoffs, shotgun falloff and knockback, heat and barrel spin behavior, penetrating rounds that hit each target once, and scaled flame damage. Knives deal heavy close-range and rear-attack damage, but windup and recovery slow movement, prevent shooting or dodging, and increase damage taken while committed.

Existing campaign slots retain their IDs, equipment, regional progression, and previous assignments. New cats and missions appear when the updated game is loaded. Reload the game page after replacing its files.

## Play

1. Extract the complete ZIP.
2. Open **index.html** inside the extracted game folder in a current desktop Chrome or Edge browser.
3. Choose an empty campaign slot and **Begin the resistance**. Sound starts after your first click or controller action.

Keep `index.html`, `config.js`, `css`, `js`, `data`, and `assets` together. There is no installation, build step, account, database, or game server. Static HTTPS hosting is recommended for a published library. The game also runs from an ordinary static file server if a browser restricts local files.

## The first five minutes

- Talk to the quest scout south of the starting flag. They can explain the region and accept or track local assignments.
- The settlement is peaceful. Its quartermaster heals and restocks your supplies. The forge is southeast of the starting square, at **1730, 1670**.
- Follow the road east to Orchard Checkpoint. Use cover, keep moving, and roll through incoming fire. A marked attack gives you time to leave its landing zone.
- Use the pistol, knife combinations, grenades, and Airstrike together. Medic Drop and field dressings keep the team fighting.
- Defeat every guard to liberate an installation. It becomes a friendly supply and travel point. Clearing the first two story outposts reveals your regional commander mission.

## Controls

| Action | Keyboard / mouse | Standard controller |
|---|---|---|
| Move | WASD | Left stick |
| Aim | Mouse | Right stick; colored crosshair |
| Shoot | Left mouse | RT / R2 |
| Knife | Right mouse | X / Square |
| Heavy knife | Shift + right mouse | Hold X / Square |
| Dodge | Space | A / Cross |
| Interact / revive | E | B / Circle |
| Primary ability | Q | Y / Triangle |
| Secondary ability | F | LT / L2 |
| Grenade | G | RB / R1 |
| Switch firearm | Tab | LB / L1 |
| Reload | R | D-pad down |
| Field medicine | C | D-pad up |
| Inventory | I | View / Select |
| Open / close menu | Esc | Start / Menu |
| Map / missions / skills | M / J / K | Field menu navigation |

Keyboard and controller bindings can be changed in **Controls**. The menu also supports stick swapping. See `documentation/controls.md` for Player 2's optional keyboard bindings and detailed controller setup.

Choose **Enter fullscreen** from the title screen, Camp menu, or Settings. The in-game option changes to **Exit fullscreen** while active; the browser's Esc shortcut also exits fullscreen.

## Two heroes

Select Local Co-op before starting, or choose Welcome Player 2 in the Camp menu during play. Start opens the menu, and pressing Start again closes it. Keyboard + controller and two-controller arrangements are supported. Each fighter has independent health, ammunition, equipment, upgrades, skills, and ability cooldowns. The camera follows both heroes and limits separation. Approach a fallen teammate and interact, then remain close to complete the revive.

Resting Player 2 from the pause menu preserves that hero's entire profile inside the campaign. Rejoining restores it. Both players share world liberation and mission progress.

## Hard-earned equipment and the forge

You begin with a field pistol and a blade. Each quartermaster stocks a small regional selection of basic firearms, armor, and supplies. Purchased firearms still require their hero level, commander blueprint victories, cores, and gold. Most unusual firearms are **reward-only**: defeat a regional commander, a named reward target, or a cavern guardian to recover them. They cannot be purchased from a shop. Ordinary enemies do not drop equipment. Equipment descriptions identify the source. Commanders award cores; hidden caches and occasional supply patrols provide additional cores.

The five visible gun families are pistol, SMG, rifle, shotgun, and launcher. The 53 firearm catalogue entries include three- and five-shot bursts, piercing slugs, charged rail shots, ricochets between enemies, guided rockets, instant beams, scatter weapons, fire, stacking poison, frost and shatter combinations, splash explosions, heat management, and heavy-gun spin-up. Precision, heavy, and experimental weapons use the closest illustrated attachment family.

Six encounter armors add abilities beyond protection: **Rollshell** improves dodging and pushes enemies away; **Wayfarer’s Thread** improves movement and reloads while dodging; **Rimeheart** resists cold and releases a defensive frost pulse; **Venomskin** resists poison and heals after poisoned kills; **Cinderproof** resists fire and leaves burning ground during a dodge; **Phaseweave** extends dodge protection and can grant a shield after a kill. These rewards occupy the armor equipment slot, independently of the three visual outfits.

Visit a settlement forge to reinforce your equipped firearm or armor up to ten ranks. Advanced upgrade milestones also require a core. All three armor outfits have distinct original character artwork for both cats:

- **Scout:** your starting outfit.
- **Ranger:** two commander victories, 900 gold, 60 scrap, and four cores.
- **Vanguard:** five commander victories, 2,400 gold, 120 scrap, and eight cores.

Outfit patterns stay unlocked after crafting. Armor reinforcement remains when changing outfits. Stat-bearing jackets, helmets, and accessories are equipped independently. The character base contains no baked-in arms or gun; each matching gun attachment includes the arms. The renderer keeps these attachments upright as you aim.

At firearm rank +3, unlock **Power**, **Rapid**, or **Tactical** tuning for 400 gold, 18 scrap, and a commander core per pattern. Power increases damage with more spread. Rapid improves firing and reloading speed. Tactical grants a family-specific effect such as ricochets, chain hits, piercing, burning pellets, or guided rockets. Switching between already unlocked patterns is free at a forge.

## Campaign and content

The 18,720 × 14,560 overworld contains eight regions plus the Berlin Sector, eight regional commanders and a final boss, 32 additional enemy strongholds, 20 peaceful settlements, 20 forges, 36 named cat contacts, 20 bounty centers, 24 supply caches, and entrances to 16 playable cavern interiors. The shipped world has **248 named locations and 485 enemy spawn definitions**. There are 25 main missions and 112 optional assignments, including 16 vault quests; 44 regular enemy roles; four cavern guardian families; 53 firearms; 20 blades; 24 tactical abilities; and 78 pieces of armor, headwear, and accessories. Friendly cat merchants, medics, farmers, blacksmiths, scouts, and residents animate around peaceful towns and liberated bases.

Quest scouts offer courier escorts with vulnerable allies and ambushes, timed defense points with attacking waves, targeted officer assassinations, named general bounties, and cavern investigations. The HUD and journal show the current action, target name, compass direction, and distance; the tracked objective also receives a screen-edge direction arrow. Accept an escort or defense mission to begin its live event; distant events remain dormant. A failed escort can be retried through a quest scout. Progress and active mission state are saved.

Cavern murals show each puzzle's rule. Shoot the marked rune or star stones; use Interact or a shot to rotate mirrors and pipe joints. The light beam and flowing water show whether the mechanism is connected. Solve the chamber to open the guardian room, defeat its guardian, then open the reliquary. Both heroes must gather at the stairs to return to the surface. One-time treasure claims and completed puzzles persist when revisiting.

## Find and play the new encounters

- **Camp defense:** Speak to Captain Saffron, Ranger Crag, Trader Sol, or Engineer Cinder and choose their work topic. Accept and track the camp assignment, follow its arrow, and ring the defense bell with **E / B**. Defeat every enemy in each of three or four waves while protecting the supply chest. The counter shows remaining enemies and the chest's integrity. Losing the chest, losing both fighters, or abandoning an active defense fails the attempt. Return to its bell or accept the assignment again to retry. Successful rewards are granted once.
- **Remote demolition:** Scout Juniper, Medic Lumi, Harbormaster Reed, and Captain Dawn offer the new demolition jobs. Use **E / B** at each of the three marked drives to plant its charge. An armed indicator remains visible. After all three are planted, follow the updated quest arrow to the separate remote switch and interact to detonate them together. The switch cannot fire early. Placed charges persist through saves and dungeon visits.
- **Survival caverns:** Enter Moonmoss Cavern, Aurora Cavern, Sunken Hideaway, or Citadel Catacombs. Gather both heroes at the entrance, clear the den, and approach the blue-flame watch altar. Press **E / B** to begin. Three or four escalating waves must be defeated before the guardian seal opens. The screen counter reports enemies remaining and the short break between waves. Then defeat the guardian and claim its reliquary. Retreating preserves an unfinished wave and enemy wounds; a party defeat resets an unfinished trial for another attempt. Relics can be claimed only once.

Earlier campaign saves remain usable. Surface progress, inventory, conversations, and completed missions are retained; an already solved cavern stays open even if that site now hosts a survival trial. The new NPC jobs appear when the updated files are loaded. Use **Export save** before moving a campaign to a different browser or hosting address.

If you defeated commanders before this update, a missing reward-choice cache appears at those strongholds when you load the campaign. Existing inventory and uncollected rewards are checked to avoid duplicates. The catch-up also works when your save begins underground.

Open **Skills** with **K**, through the field menu, or through the tactical-loadout HUD shortcut. Inspect each ability's effect, requirements, and cooldown; learn new powers with skill points and equip either active slot. The original twelve powers retain their level unlocks, including immediate Airstrike, Medic Drop, and Shockwave. New movement, defense, control, attack, and support powers provide more ways to build your hero. Inventory's Abilities category also exposes the loadout. Cooldowns follow each ability when you swap slots.

Gravelback combines armored rolls, expanding faultline slams, rock fans, and chained charges. Gloamwing alternates swoops, icicle fans, and delayed falling-ice barrages. Mother Briar lays venom pools and web snares, calls a brood, and spits venom fans. The Hollow King mixes delayed teleport strikes, traveling burrow eruptions, and void volleys. Their warnings mark committed attack areas; lower health changes their patterns and pressure.

Leapers pounce into warning circles; bruisers vault and slam; mortars bracket your position; sappers leave dangerous ground; skirmishers dodge and fire bursts; frost troops slow the team with spreading shots. Commanders have three health phases and their own movement and special attacks, including charges, leaps, skating attacks, sentry construction, poison pools, and barrages.

Only enemies near either active player are simulated, with a maximum of 160 active enemies. Persistent damage, defeated guards, opened caches, discoveries, and liberated locations survive unloading and saving. The world map includes exploration fog, quest markers, waypoints, and travel to discovered friendly locations outside combat.

## Saving

There are three local campaign slots. The game autosaves periodically, after important progress, and when leaving. Use **Save campaign** for a manual save. Browser storage belongs to the browser and website address used to launch the game. Export a backup in Settings before moving to another browser, publishing to a new address, or clearing browser data. Import restores a backup to the selected slot.

## Graphics, sound, and performance

Settings include render resolution, quality, minimap visibility, screen shake, damage numbers, and separate music, effects, and interface volumes. Original transparent animation atlases and terrain graphics are included. The adaptive score and effects are synthesized locally; matching WAV exports are also included.

This implementation uses **JavaScript and Canvas 2D** with cached terrain chunks, spatial collision indexes, capped reusable projectile/effect pools, and sprite atlases. It is dependency-free rather than Phaser-based. Gameplay does not require network access. A 60 FPS target guided the implementation; performance depends on the browser, screen size, and hardware and is not guaranteed on every computer.

## Deployment and source

Upload the folder to static hosting and link its `index.html` from a CatnMice lobby tile. Set `OW.config.assetBaseURL` in `config.js` to relocate all graphics to an R2/public CDN assets directory. See `documentation/deployment.md` for the precise folder and URL rules.

- `documentation/controls.md` — complete controls and remapping.
- `documentation/asset-manifest.md` — original graphics, frame layout, and provenance.
- `documentation/art-direction.md` — enemy silhouettes, animation states, and puzzle readability conventions.
- `documentation/development-guide.md` — source structure, systems, and extension points.
- `documentation/acceptance-report.md` — checks performed and remaining manual verification.
- `tests/` — repeatable dependency-free system checks.

The campaign ends with Adolph Whisker after all eight regional commanders. Cavern interiors and their relics are optional adventures alongside that campaign. The original rescue and convoy missions use guarded prisons and supply depots; courier escorts and authored objective missions are separate live events. Moving train battles are outside this release. Equipment uses a finite catalogue and upgrade ranks.

Two physical controllers and Bluetooth reconnection still require testing on the target computer. The included simulated controller tests verify input independence, mapping, aiming, joining, and menus; they cannot certify a particular controller model.

