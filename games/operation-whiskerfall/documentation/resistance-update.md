# Resistance update — 1.8 playable preview

This is the first staged implementation of the requested gameplay update, expanded with three invasion scenarios and three hidden adventures. It is a playable preview, not a declaration that the entire campaign has passed human acceptance playtesting. The remaining 19 abilities retain their previous effects and learning rules.

## What changed

### Defense clarity and pressure

All eight road holds say **Hold the area for 45 seconds**. Their remaining time advances only while a standing hero is inside the circle; leaving explicitly pauses it. They can succeed with enemies alive. Wave defenses display their wave, enemies remaining, supply integrity and preparation breaks. Those breaks are not a deadline to kill the wave. No mandatory overall kill timer was added.

The reproducible pressure fault was **A Hearth in the Ash** (`camp_waves_6`). A deterministic controller using ordinary level-appropriate equipment lost its supplies in 1.1 seconds solo and 1.4 seconds in co-op. Sunscar supplies also collapsed quickly. Regional enemy damage, applied directly to an unprotected objective, caused the apparent race. The scripts and before/after measurements are included in `tools/defense-balance.cjs` and `documentation/defense-balance-*.json`.

Wave encounters now use encounter-specific level scaling rather than compounding the overworld multipliers. Fresh camps have reinforced supplies, 65% damage protection, and recovery breaks that restore 18% integrity and supply 60 reserve rounds. This affects objective pressure without reducing ordinary roaming-enemy damage. Old active encounter records retain their stored health and position.

| Changed camp | New purpose / location |
| --- | --- |
| Hold the Orchard Line | Harvest Crews’ Orchard Camp, separate from the road hold |
| Turn the Lantern Line (old `camp_waves_2`) | Hold Lantern Ridge for 18 seconds, pursue the battery captain, then disable command; withdrawal checkpoint retained |
| Last Water at Sundial | Sundial Water Convoy, away from its timed road post |
| A Hearth in the Ash | Ashford Evacuation Yard, with revised supplies and encounter pressure |

In the final equal-control audit all 20 camp/coastal solo/co-op scenarios completed. Emberworks completed in 64.2 seconds solo and 38.6 seconds co-op; the longest coastal evacuation took 170.5 / 124.0 seconds. An earlier stalled automated trial is retained and explained in `defense-update.md` rather than hidden.

The four survival caverns and six coastal defenses retain their wave identities and receive the encounter pressure and reachability fixes. Camps require actual defeats; disappearing through streaming does not count. Failure messages identify the cause and tell players how to retry. Previously active Stonecrest wave saves can finish their original encounter, preserving progress.

### Invasions and campaign escalation

Three handcrafted **small invasion prototypes** connect a coordinated offensive, a compromised evacuation route, and the final supply push. Each changes the frontline through a 20-second hold, a moving evacuation, and a siege-command counterattack. Stages 1 and 2 save checkpoints. The final stage requires defeating the captain and interacting with the command engine; it does not require clearing every surviving enemy against a clock.

| Battle | Contact / unlock | Recommended level |
| --- | --- | --- |
| When the Orchard Answers | Captain Saffron, after the first Orchard main assignment | 3 |
| The Night Warmhearth Fell | Medic Lumi, after the Frostmarch commander assignment | 10 |
| All Roads to the Resistance | Captain Dawn, after the Blackbanner commander assignment | 22 |

At the muster, choose rescued medics for healing or reinforce the gate for 40% more supplies. Riflecats fire real shots, medics heal injured heroes/allies, and engineers repair supplies. Enemies can damage allies and the supplies. Once the families have escaped, the final counterattack no longer has a supply-failure condition. Earned rifle, medic and engineer crews also join the Berlin confrontation, capped at three allies; their injuries persist through saving and loading. A failed stage can be retried at its banner without replaying completed stages. The simulation caps active invasion troops and uses staggered arrivals; this is deliberately a small-scale prototype pending human readability and performance review.

### Exploration and unique equipment

These five items are Epic, reward-only, and append to the existing catalogues. Each eligible active or resting hero receives a copy, with a saved claim ledger; a later-joining hero catches up. Claims never repeat for an already rewarded hero. Existing equipment is retained.

| Reward | Acquisition / discovery clue | Level | Distinctive effect |
| --- | --- | ---: | --- |
| Lanternline Rifle | Find Tinker Wick near Owl’s Grotto in Mosswood; recover two parts and defeat the receiver guards | 5 | Controlled hits build up to 18% bonus against flanked or recovering enemies; rapid fire or a miss resets focus |
| Breachmaker Shotgun | Finish the winter invasion with Lumi | 10 | +25% close-range pellet damage against armored roles; four-shell magazine, 2.5-second reload |
| Signalstorm Carbine | Finish the Orchard invasion with Saffron | 1 | Four accurate hits mark a foe for 3 seconds; +8% damage for heroes and allied defenders |
| Last Watch Armor | Find Warden Tallow near the ruined Stonecrest watchtower; restore the signal and defeat its assault leader | 7 | 25% armor, +48 health; well-timed projectile dodge grants a limited 35-damage ward |
| Blackglass Pathfinder Armor | Follow violet survey clues beyond Ember Rest to Scout Vesper and an elite patrol (adventure level 19) | 16 | 15% armor, +28 health; dodge grants brief movement and next-reload benefits |

The two armor rewards are complete suits in the existing single armor slot. Their set benefit is the stated special effect; extra pieces are unnecessary. Guns retain the existing +10 forge progression. Outfit reinforcement improves armor health/protection while the special effects stay fixed. Discovery quests are optional and their items cannot be lost through a dialogue branch. Gunsmith is a cave-side recovery adventure; it does not replace the existing cavern interior.

### Armor wardrobe

Open **Inventory → Armor** to compare suits in the illustrated wardrobe. It shows a larger preview for the selected hero, the currently worn armor, protection/health comparisons, special effects, and direct equip controls for owned gear. Comparisons account for the hero's existing reinforcement and other equipment; looking at an unowned suit does not grant it or change the hero.

Last Watch and Blackglass Pathfinder appear with their specific side-quest names and discovery clues before they are found. They remain exclusive rewards for **The Last Watch** and **The Blackglass Trail**; neither can be bought or crafted. Existing forge suits retain their commander/crafting requirements, ordinary armor keeps its existing availability, and each co-op hero equips their own earned copy.

Seven original transparent image assets provide menu artwork, three equipped gun appearances, orange/white cat animation appearances for both armor suits, and illustrated weapon attachments with trigger and support paws. The attachments follow the existing shoulder, aim, recoil, reload and facing behavior. Measured source crops keep sheet frames separate. Provenance, prompts and frame metadata are stored alongside the assets. Existing rarity labels and item descriptions explain the rewards.

The bundled **art-gallery.html** opens on the new weapons and armor collection, including both gripping-arm sheets. In-chat previews also show actual equipped characters rendered offline by the game renderer.

### Skill-based combat and ability mastery

The Fencer commits to a 0.75-second amber warning lane, then a 0.32-second lunge. Sidestep or interrupt with a blade; its 1.05-second green recovery takes 20% extra damage. Warnings remain visible during stun/freeze. A lunge defeat names its cause and counterplay.

Airstrike, Medic Drop, Shockwave, Dashstep and Aegis Field each have three ranks. Rank 2 costs one skill point; rank 3 costs two more. Skills shows exact current and next effects, unlock requirements and cost. A free reset refunds only spent upgrade points, retaining learned powers, passive training, equipped slots and live cooldowns. Each hero owns separate ranks. See `documentation/ability-mastery.md` for the complete values.


### Ironhide rolls and deeper cavern guardians

Ironhide mice now roll **13% less distance**, retaining their existing speed, warning and recovery. This adjustment does not silently shorten every guardian charge.

Cavern bosses progress through four regional tiers: the first two regions introduce two family moves, the next two use three, regions 4–5 use four, and regions 6–7 use five. Each guardian family gains different techniques: expanding fault rings and chained rolls, icy barrages and crosswinds, brood and staggered venom traps, or burrow lines and royal echoes/rings. Attack warnings and recovery openings remain explicit.

The existing increasing solo guardian-health curve is retained; co-op guardians receive 25% more health, recorded when their encounter is initialized. Regional damage adds a modest 2% per region. Summoned brood use explicit level-based health/damage so they cannot accidentally receive exponential regional scaling twice. Saving, re-entering and defeat reconstruct canonical stats without healing an injured boss or multiplying its maximum health again. Defeated guardians and claimed treasures remain defeated and claimed.
## Save compatibility

- Original browser save keys, campaign IDs, item indices and ability indices remain intact; new catalogue entries are appended.
- Old learned powers become rank 1 without an extra point grant. Earlier skill-book compensation remains unchanged.
- Resting co-op heroes retain ranks, equipment, rewards and cooldowns.
- Active invasion stages, injured allies, supply health and enemy records are saved. Streaming and repeated loading must not clone enemies.
- Existing completed quests stay completed. New reward claim ledgers are per hero.
- Synthetic legacy-save and repeated-load checks are included. The user's personal browser campaigns were not opened or modified during testing.

Keep opening the game at its existing address to retain access to browser-local saves. Export a campaign from Settings before choosing to move the game to a different address.

## Verification and remaining acceptance work

The original baseline passed all 49 test files. The final update passes **all 60 automated test suites and all 52 runtime JavaScript syntax checks**. The added behavioral checks cover upgrades, Fencer counterplay, defense clarity/retry, invasions, hidden guards, unique rewards, illustrated gripping arms, the armor wardrobe, and guardian progression. Final machine-readable results are in `documentation/test-results.json`; pressure simulations record equipment, completion times, failure causes, and active-enemy peaks.

The balancing controllers use real movement, collision, enemy AI, bullets and damage. Their observation limits are diagnostic limits, never gameplay deadlines. Their scenarios isolate the encounter from unrelated ambient spawns; they are not representative of every human strategy or device.

Browser inspection could not be completed: the in-app browser timed out on the local preview and the Windows computer-use service stopped because it could not reliably determine Chrome's URL. No further UI interaction was attempted. Artwork sources and an offline image from the actual game renderer were inspected directly, and rendering/crop behavior is covered by automated checks; live inventory/combat appearance, camera comfort, all builds, physical controllers and performance on target hardware still need human acceptance playtesting. No large-scale battle performance claim is made.

Suggested acceptance route: open the existing game, check an old campaign, perform a road hold and leave/re-enter its circle, play Turn the Lantern Line solo and with a partner, try each invasion and a mid-stage save/retry, discover one hidden quest, compare both cats' new equipment appearances, then buy/reset/swap each upgrade without resetting its cooldown.



