# Defense rules, mission changes, and balance evidence

## What was reproduced

The eight road assignments were already **45-second holds**, not timed extermination missions. At least one standing hero within 190 world pixels advances the timer. Leaving the circle pauses earned time. Surviving attackers do not prevent success.

The four original camp assignments, four survival caverns and six coastal defenses were already **wave-clear missions with no overall kill deadline**. Their short countdowns announce the next wave. Camps additionally fail if their supplies are destroyed, all heroes fall, or the party abandons the battle. Survival caverns still require the guardian and treasure after clearing the trial.

The reproducibly harsh encounter was **A Hearth in the Ash**, `camp_waves_6`. In the original game, the seeded controller lost its supply chest in **1.1 seconds solo / 1.4 seconds co-op**, using a level-19 hero, Reedrunner Carbine +3 and ordinary armor +4. Both heroes could still be standing. **Last Water at Sundial** also lost its chest almost immediately. The failure was supply damage, not expiry of a kill timer.

Regular regional scaling inflated encounter health and damage sharply, while a stationary supply proxy took unmitigated projectile and blast damage. Those paths directly subtracted from escort health, bypassing normal player armor. A separate pathing problem treated movement below five pixels *per frame* as stuck; slow walking enemies therefore teleported repeatedly despite making progress.

## Changes

- All eight road holds now explicitly say **“Hold the area for 45 seconds”**, display remaining seconds, warn when progress pauses, and explain that every enemy need not die. Either standing co-op hero can keep the countdown running.
- Authored scans and short uplinks show channel duration and remaining seconds. An interrupted channel explicitly says it restarts; it is not a kill deadline.
- All camp and cavern objective descriptions distinguish enemy counts from intermission countdowns. A failed camp retains its specific failure reason and points to its bell for retry.
- **Hold the Orchard Line** now uses Harvest Crews’ Orchard Camp, separate from the Orchard road hold.
- **The Lantern Must Stay Lit** becomes **Turn the Lantern Line**, retaining `camp_waves_2`. Hold Lantern Ridge for 18 earned seconds, pursue the battery captain, then interact with the command post. Survivors retreat when the frontline moves; their disappearance grants no kills. The withdrawal is a checkpoint, so retrying the counterattack does not repeat the hold.
- **Last Water at Sundial** moves to a separate water-convoy site.
- **A Hearth in the Ash** moves to a separate evacuation yard.
- New camp attempts have 750 / 1,400 / 2,200 / 3,200 supply integrity in regional order. Reinforced supplies take 35% incoming damage consistently across bullets, explosions, special effects and melee.
- Clearing a wave repairs 18% supply integrity and supplies each nearby standing hero with 60 reserve rounds, capped at 600. This transaction occurs once at the wave transition and survives reloads.
- New wave enemies use the recommended regional level: their health multiplier is `(1 + enemyLevel × .12) × (1 + (regionalLevel − 1) × .11)`, plus any authored wave bonus. Encounter damage replaces the exponential regional multiplier with `1 + (regionalLevel − 1) × .035`. Ordinary overworld enemies and guardians retain their own rules.
- Generic waves cap at eight actors; authored coastal waves retain their modest co-op additions. Spawning respects the global active-enemy cap. Candidates and stuck-enemy recovery seek unobstructed approaches. Stuck detection now measures movement relative to elapsed time, allowing normal slow pursuit.

## Save behavior

Quest, reward and road-post IDs are retained. A previously completed assignment remains completed. An old active camp keeps its exact battlefield coordinates, integrity, wave progress and traditional wave plan; it gains reinforced-supply protection when loaded. Retrying uses the new site and layout. A saved Stonecrest counterattack retains its captain identity, surviving enemy health and withdrawal checkpoint. Neither saving nor streaming is counted as an enemy defeat. Temporary supply proxies never enter saved mission data.

## Validation and limits

`tests/defense-clarity.test.cjs` checks all eight holds in solo and co-op, pause/resume, success with surviving enemies, separate traversable camp sites, counterattack progression and checkpoint retry, exact legacy integrity/position restoration, one-time intermission recovery, and slow-versus-stuck enemy handling. Existing encounter, coastal and NPC handoff suites also pass.

`tools/defense-balance.cjs` runs real weapon projectiles, enemy AI, terrain collision, damage, healing, ammunition and objective logic with deterministic input. The character level and equipment are recorded in each result. The final audit resets the random seed per scenario, uses abilities, collects ammunition and repositions around cover. It excludes unrelated ambient patrols so encounter pressure is reproducible. The 300-second observation limit belongs to the test, **not the mission**.

- `defense-balance-before.json`: original-game results with the final controller.
- `defense-balance-after.json`: updated-game results with the same controller.
- `defense-balance-initial.json`: original first reproduction, retained for traceability.
- `defense-emberworks-investigation.json`: a separate seeded Emberworks run, which completed in 62.9 seconds solo and 45.5 seconds co-op before the final pathing fix.

The equal-control audit completed **all 20 updated camp/coastal scenarios**. Orchard completed in 45.9 / 31.5 seconds, the redesigned Stonecrest counterattack in 21.9 / 20.5 seconds, Sunscar in 59.7 / 31.8 seconds, and Emberworks in 64.2 / 38.6 seconds (solo / co-op). The six coastal assignments completed in 48–170.5 seconds solo and 32.1–124 seconds co-op. Original-game failures were overwhelmingly supply destruction; only the Orchard and Stonecrest co-op cases completed with this controller.

An earlier automated sweep completed 19 of 20 scenarios; one Emberworks solo run stalled at the observation limit despite a separate seeded run completing. That result motivated the cover/ammunition controller improvements and the slow-movement regression. These measurements are repeatable automated combat evidence, not human playtesting. Required full-campaign runs, physical-controller co-op, every character build and visual clarity under realistic player movement still require hands-on acceptance testing.
