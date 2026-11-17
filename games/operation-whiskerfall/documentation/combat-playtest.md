# Reconnaissance combat playtest

Run the focused tests from the game folder with `node --test tests/recon-combat.test.cjs`. The eleven tests exercise the production attack planner and hit geometry with controlled actors, cover, clocks and transitions. They cover the catalogue append, six role sequences, two heroes at opposite lane edges, ring gaps, windup extension, pause, signal interruption, shield breaks, scene cancellation, all four Berlin phases and two-player escape from overlapping threats. The atlas regression checks separate recovery, hurt and defeat frames for all six patrol roles and phase-specific attack poses for Whisker.

## Browser captures

[Watch the patrol and all four Berlin patterns at normal speed](media/recon-combat-normal.webm). [Inspect the same frames at quarter speed](media/recon-combat-quarter-speed.webm).

Chrome 157.0.8103.52 on Windows rendered these five staged encounters at 1280 × 720. Each clip contains three seconds of simulation sampled at 12 frames per second. The montage uses the game canvas, downsampled to 800 × 450 with a caption identifying each encounter. Both heroes are visible. High-contrast warnings were enabled and camera shake was off. The captures stage starting health for each phase. The separate continuous fights below crossed all four thresholds.

## Regional comparison

A level-15 hero in region 4 fired at the same Needleblade Fencer from an initial separation of 178 world units. Both builds used firearms skill 3, three weapon upgrades, the same aim and a seeded random stream. The simulated hero stood still with an enlarged health pool to measure every incoming hit through the kill. The Field Pistol received separate trigger presses. The scattergun fired whenever ready. Each row represents one run per version.

| Loadout | Time to kill, main → recon | Incoming damage | Attack starts per second | Time outside exposed recovery |
| --- | --- | --- | --- | --- |
| Field Pistol | 22.12 → 13.12 s | 5,780 → 1,435 | 0.452 → 0.610 | 12.63 → 7.28 s |
| Trench Scattergun | 12.08 → 8.07 s | 2,890 → 1,025 | 0.497 → 0.620 | 6.83 → 4.73 s |

The regional Fencer had 2,825 health on main and 1,637 with the expansion. Attack starts count transitions into its locked lunge. Time outside recovery includes approach and attack. Players may also deal damage during those intervals.

## Busy-scene frame pacing

Headless Chrome 157.0.8103.52 on the same Windows host rendered the same two heroes, two Fencers, Blink Stalker, Cinder Mortar, Prism Sentry and roller at 1280 × 720. The hero pair fired in short bursts. Each run used the same world point (16500, 11180), six living enemies, 30 warm-up frames and 150 measured requestAnimationFrame intervals. Both builds had a median of ten active effects/projectiles. The sample includes terrain, actors, projectiles and HUD drawing. Shared host load and headless presentation limit extrapolation to hardware gameplay.

| Metric | Main | Recon |
| --- | ---: | ---: |
| Median presented frame interval | 33.3 ms | 33.3 ms |
| 95th percentile frame interval | 50.2 ms | 50.1 ms |
| Median JavaScript update/draw submission | 9.6 ms | 9.6 ms |
| 95th percentile update/draw submission | 21.3 ms | 23.9 ms |
| Intervals over 34 ms | 25 / 150 | 24 / 150 |

In a separate two-hero regression with extended warnings, a shooter deferred its second overlapping lane while walls confined both heroes. Opening the side routes let that shooter commit. The actual browser captures show two heroes and the high-contrast boundaries. The two-controller physical readability check remains open.

## Berlin

The scripted party used level 26, firearms skill 4, four weapon upgrades, 35% armor reduction and ample reserve ammunition. It followed the boss, avoided marked attacks and steered back into the arena when cover blocked its shots. The simulation used ordinary firing, reloading, dodge, projectiles, collisions, reinforcements and boss AI at a 1/60-second step. The fixture maintained health to measure damage and encounter duration across all four phases.

| Party | Boss health | Time to defeat | Aggregate damage taken |
| --- | ---: | ---: | ---: |
| Solo Field Pistol | 9,500 | 54.12 s | 982 |
| Solo Trench Scattergun | 9,500 | 32.15 s | 339 |
| Two Field Pistols | 13,490 | 40.47 s | 1,209 |

An earlier controller simulation kept moving away from the attack without steering back into a firing lane. Its two solo runs reached the 220-second cutoff, with the pistol in phase II and scattergun in phase IV. Positioning and cover materially affect these timings. No physical controllers, human survival runs, complete campaign timing study or exhaustive weapon-family mastery trials were used for these measurements.
