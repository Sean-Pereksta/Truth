# Reconnaissance combat playtest

Run the focused tests from the game folder with `node --test tests/recon-combat.test.cjs`. The twelve tests exercise the production attack planner and hit geometry with controlled actors, cover, clocks and transitions. They cover the catalogue append, six role sequences, two heroes at opposite lane edges, ring gaps, windup extension, pause, signal interruption, shield breaks, scene cancellation, all four Berlin phases and two-player escape from overlapping threats. The impact fixture checks which hero receives a painted hit and where a missed shot ends at cover. The atlas regression checks separate recovery, hurt and defeat frames for all six patrol roles and phase-specific attack poses for Whisker.

## Browser captures

[Watch the patrol and all four Berlin patterns at normal speed](media/recon-combat-normal.webm). [Inspect the same frames at quarter speed](media/recon-combat-quarter-speed.webm).

Chrome 157.0.8103.52 on Windows rendered these five staged encounters at 1280 × 720. Each clip contains three seconds of simulation sampled at 12 frames per second. The montage uses the game canvas, downsampled to 800 × 450 with a caption identifying each encounter. Both heroes are visible. High-contrast warnings were enabled and camera shake was off. The captures stage starting health for each phase. The separate continuous fights below crossed all four thresholds.

The ground warning sits above the terrain and below the actors. Its boundary uses the same coordinates as the attack. The relay marks the outside edge of its sweep and leaves the gap open. Each spent beat uses one pooled effect to draw its fading floor trace and local contact marks. Reduced Flash retains the subdued floor trace. The art gallery includes the eight painted muzzle, strike, guard, slash, dust, water, lantern and signal motifs.

## Regional comparison

A level-15 hero in region 4 fired at the same Needleblade Fencer from an initial separation of 178 world units. Both builds used firearms skill 3, three weapon upgrades, the same aim and a seeded random stream. The simulated hero stood still with an enlarged health pool to measure every incoming hit through the kill. The Field Pistol received separate trigger presses. The scattergun fired whenever ready. Each row represents one run per version.

| Loadout | Time to kill, main → recon | Incoming damage | Attack starts per second | Time outside exposed recovery |
| --- | --- | --- | --- | --- |
| Field Pistol | 22.12 → 13.12 s | 5,780 → 1,435 | 0.452 → 0.610 | 12.63 → 7.28 s |
| Trench Scattergun | 12.08 → 8.07 s | 2,890 → 1,025 | 0.497 → 0.620 | 6.83 → 4.73 s |

The regional Fencer had 2,825 health on main and 1,637 with the expansion. Attack starts count transitions into its locked lunge. Time outside recovery includes approach and attack. Players may also deal damage during those intervals.

## Busy-scene frame pacing

The same two heroes fought two Fencers, a Blink Stalker, a Cinder Mortar, a Prism Sentry and a roller in region 4 at world coordinates (16500, 11180). Each run used a fresh Chrome process, a fixed random seed, two pistols firing in bursts, the high graphics setting, device pixel ratio 1, 45 warm-up frames and 180 measured animation-frame intervals. Six enemies were alive throughout. The diagnostic advances player input, AI, projectiles, effects and camera at a fixed simulation step, then draws the world and updates the HUD on each browser frame.

| Build and viewport | Final canvas | Median frame | 95th percentile frame | Median / 95th submission | Frames over 34 ms |
| --- | --- | ---: | ---: | ---: | ---: |
| Original 720p, fixed | 1280 × 720 | 16.7 ms | 33.3 ms | 4.9 / 9.0 ms | 1 / 180 |
| Recon 720p, fixed | 1280 × 720 | 16.7 ms | 33.2 ms | 5.2 / 9.1 ms | 1 / 180 |
| Original 1080p, fixed | 1920 × 1080 | 33.3 ms | 50.0 ms | 3.6 / 7.3 ms | 13 / 180 |
| Recon 1080p, fixed | 1920 × 1080 | 32.8 ms | 33.5 ms | 4.4 / 7.5 ms | 5 / 180 |
| Recon 1080p, Automatic | 1651 × 929 | 16.7 ms | 33.4 ms | 4.5 / 8.2 ms | 5 / 180 |

Automatic began at 1920 × 1080. The median number of active projectiles and effects ranged from 9 to 11 across the five samples, with peaks of 18 or 19. Each row is one run in headless Chrome 157.0.8103.52 on Windows with an AMD Ryzen 7 5825U. Browser animation-frame intervals include scheduling and presentation delays. JavaScript submission measures the game update and canvas/HUD commands. This setup does not measure a physical display's refresh or controller latency.

To reproduce a row, run `node tools/profile-combat.cjs . 1920 auto` in the game folder with Playwright available. Substitute a clean original game directory for `.` to sample the old code. Use `1280 fixed` or `1920 fixed` to hold the renderer at native resolution. Set `CHROME_PATH` for an installed Chrome executable. The command prints the frame counts, interval and submission percentiles, longest frame, effect counts and actual canvas size.

In a separate two-hero regression with extended warnings, a shooter deferred its second overlapping lane while walls confined both heroes. Opening the side routes let that shooter commit. The actual browser captures show two heroes and the high-contrast boundaries. The two-controller physical readability check remains open.

## Berlin

The scripted party used level 26, firearms skill 4, four weapon upgrades, 35% armor reduction and ample reserve ammunition. It followed the boss, avoided marked attacks and steered back into the arena when cover blocked its shots. The simulation used ordinary firing, reloading, dodge, projectiles, collisions, reinforcements and boss AI at a 1/60-second step. The fixture maintained health to measure damage and encounter duration across all four phases.

| Party | Boss health | Time to defeat | Aggregate damage taken |
| --- | ---: | ---: | ---: |
| Solo Field Pistol | 9,500 | 54.12 s | 982 |
| Solo Trench Scattergun | 9,500 | 32.15 s | 339 |
| Two Field Pistols | 13,490 | 40.47 s | 1,209 |

An earlier controller simulation kept moving away from the attack without steering back into a firing lane. Its two solo runs reached the 220-second cutoff, with the pistol in phase II and scattergun in phase IV. Positioning and cover materially affect these timings. No physical controllers, human survival runs, complete campaign timing study or exhaustive weapon-family mastery trials were used for these measurements.

## Six weapon families in Berlin

The six reconnaissance weapon families each defeated the 9,500-health Whisker and crossed all four phase thresholds in Chrome 157.0.8103.52. Each trial began at the same spot with the same random seed, one level-26 hero, four ranks in both combat skills, rank +4 on the selected weapon, 35% armor reduction, and no weapon tuning. The script used the live boss, projectiles, strikes, bleed, movement, collision, reload, charge, heat and recovery systems at 60 simulation steps per second. It approached to melee range with the two blades, released fully charged marksman shots and used heavy attacks with the maul.

| Family | Weapon | Time to defeat | Damage taken |
| --- | --- | ---: | ---: |
| Burst carbine | Rushleaf Carbine | 22.62 s | 339 |
| Scattergun | Lockjaw Scattergun | 35.53 s | 217 |
| Charge marksman | Skyneedle | 25.60 s | 456 |
| Spool repeater | Wrenwheel Repeater | 29.07 s | 581 |
| Field saber | Leafrunner Saber | 18.08 s | 897 |
| Breaching maul | Latch Hammer | 22.97 s | 553 |

The saber recorded the fastest clear and the highest incoming damage. Close-range pressure and finisher bleed contributed to both melee clears. The fixture supplied ample reserve rounds and restored hero health to count incoming damage through the entire fight. Human survival, physical-controller readability and difficulty still need playtesting.

Run `node tests/berlin-loadouts.cjs` from the game directory with Playwright available. Set `CHROME_PATH` when using a local browser installation and `NODE_PATH` when Playwright is installed outside the repository. Each trial uses a fresh page and temporary browser storage.
