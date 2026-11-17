# Opening and combat performance

**Release gate passed.** In the matched six-enemy co-op fight, the median count of frames over 33 ms fell from 155 to 70 per 180 frames. The p95 frame interval changed from 83.3 to 50.1 ms and p99 changed from 116.7 to 100.1 ms. [Raw results](opening-performance.json)

## Measured on one device

AMD Ryzen 7 5825U with Radeon Graphics, Windows 10.0.26200, headless Chrome 157.0.8103.52, fixed 1280 × 720 backing canvas, device scale 1, high graphics, high-contrast warnings, damage numbers and minimap enabled, screen shake disabled. The published combat fixture retains its original damage-number setting of off on both builds. Both versions used local files on the same machine. Each trial opened a fresh browser and profile. The operating system's file cache was shared.

Commit `6bc35c1` was frozen and its published combat profiler run before development. The release comparison ran three baseline/candidate pairs in alternating order. The original six-enemy combat profiler and each full-game encounter used 45 warm-up and 180 measured animation frames per scene. Results below are medians across the three runs. Counts represent intervals strictly greater than 33 ms.

| Scene | Baseline p95 / p99, ms | Update p95 / p99, ms | Baseline >33 ms | Update >33 ms |
| --- | ---: | ---: | ---: | ---: |
| Published combat fixture | 50.1 / 51 | 49.9 / 66.9 | 116 | 56 |
| Willow street chase | 33.5 / 50 | 33.4 / 50.2 | 61 | 20 |
| Busy co-op fight | 83.3 / 116.7 | 50.1 / 100.1 | 155 | 70 |
| Co-op fight plus both new enemies | — | 50.1 / 183.3 | — | 65 |

The field fixtures keep the roster, starting positions, input schedule, random seed and simulation clock fixed. They run the full input, world streaming, AI, collision, camera, renderer, audio and HUD loop on browser animation frames. Fixed simulation steps make the sequence of inputs comparable across frame intervals. Both fighters survive the matched fire, grenade, dodge and reload sequence. In the older build, reaching town broke the pursuit. In the update, the same patrol can attack on the street. The eight-enemy stress fixture keeps the original six positions and adds a Gallows Bell Rat and a Seam Ripper farther along the same approach. It runs after the matched memory samples. Its 183.3 ms p99 shows that perceptible stalls remain in the most crowded fight.

## Startup and travel

| Milestone | Baseline, ms | Update, ms |
| --- | ---: | ---: |
| First animation frame observing decoded title art | 2,309.3 | 642.9 |
| First animation frame observing game ready | 3,337.5 | 1,530 |
| First campaign start call | 1,715.6 | 1,173.1 |
| Return from the same orchard cavern to two surface frame callbacks | 44.5 | 83.6 |
| First use of the tutorial gate to two surface frame callbacks | — | 278.8 |
| Subsequent tutorial gate exits on the same page | — | 61.3 |

The tutorial gate is new. The orchard cavern supplies a surface transition shared by both versions. The measured cavern return took 39.1 ms longer in this build. The published combat fixture also had a higher p99 despite logging fewer intervals over 33 ms. Tutorial exit timing begins at interaction in the completed yard, after 30 frames of preparation. Playback, tutorial exercises and player reading time are outside the exit timer. With a new campaign, the baseline starts in the field and the update starts at the comic.

## Retained memory

| After start, cavern entry and return | 1 | 2 | 3 | 4 |
| --- | ---: | ---: | ---: | ---: |
| Baseline JS heap, MiB | 9.28 | 9.54 | 9.79 | 10.11 |
| Update JS heap, MiB | 9.72 | 9.89 | 10.21 | 10.30 |

| Browser private memory after visit, MiB | 1 | 2 | 3 | 4 |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 1,002.5 | 1,044.9 | 1,061.7 | 1,055 |
| Update | 1,299.5 | 1,555 | 1,288.8 | 1,260.5 |

The fourth-cycle median private footprint increased by 205.5 MiB between versions. Across the four update visits, median retained JS heap rose by 0.58 MiB, while median private bytes ended below the first visit by 39 MiB. The update uses bounded terrain, hit-flash and warning textures. Process private bytes also vary with Chromium's internal caches and reclamation.

Each visit starts a new co-op campaign, takes the tutorial gate when available, enters and leaves the same cavern, and collects garbage before reading Chrome's retained JS heap. The private-byte rows also measure Chrome's browser, renderer, GPU and utility processes using their Chrome DevTools-reported process IDs. Dedicated GPU memory is outside both measurements.

## Findings and release checks

- A timed baseline world construction spent about 712 of 844 ms placing scenery. Indexing exclusion circles by map chunk retains their original coordinates and seeded placement sequence. Separate coverage buckets also narrow discovery checks as each fighter moves.
- Rolling, fencer, mortar and prism encounters repeatedly painted the same river banks, ground details and roads. Two bounded, overscanned terrain layers keep the animated water between its banks and the road deck. Districts and coastlines with separately loaded paving continue to use their own terrain paths. Warning extents, actors, impacts and the simulation stay live.
- During overlapping attacks the renderer reuses the painted chevrons, hit silhouettes and mortar shell glow. It still draws the moving timer line, impact boundary, blinking actor and shell position every frame.
- The title defers world construction and loads opening sheets first. Optional paintings share requests by source path. While the player trains, the renderer requests nearby surface sheets and builds arrival terrain one job per animation frame. Unchanged HUD fields skip DOM replacements, and the empty discovery queue skips a redundant safety scan.
- Release requires matching settings and active fighters, fewer busy co-op frames over 33 ms, p95 and p99 within 1 ms of their baseline or better, faster startup, an eight-enemy stress sample and retained heap growth below 2 MiB across the last four visits. The harness exits unsuccessfully when a requirement fails.
- Automated game regressions cover the opening and Continue, controller bindings and ownership, warning geometry and dodge windows, street pursuit and damage, locked paths and mural/guardian combat. Physical controller feel remains a hardware playtest.

From the game directory, with Playwright and Chromium available, run the following. Set `CHROME_PATH` when using an installed Chrome executable.

```text
node tools/check-campaign-performance.cjs /path/to/unchanged/game . opening-performance.json 3
```
