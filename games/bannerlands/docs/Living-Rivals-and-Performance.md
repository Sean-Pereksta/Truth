# Living Rivals and Performance

This update gives rival houses a campaign assessment and an adaptable intent on top of their existing army plans. The assessment separates a dangerous rival from a tempting invasion and from an attack that needs an immediate response. House zero uses the same scoring rules as other houses.

**Report scope:** implementation, measured workloads, completed checks and observed limitations. Natural campaign observations cover the first 120 simulation seconds, not a complete campaign.

## Campaign judgments and actions

Each commander considers four related judgments:

- **Strategic threat:** observed military strength, known territory and castles, proximity, confirmed expansion and castle victories, hostile pressure, and progress toward the current victory condition.
- **Invasion opportunity:** a reachable castle or exposed production site, observed defenders, damage, the attacker's healthy available force, and the strength retained for defense.
- **Immediate danger:** currently visible hostile troops threatening allied castles, kings, important forces, or a visibly held objective. This can interrupt an offensive for survival.
- **Cost and risk:** legal route cost, difficult approaches, known fortifications and defended crossings, uncertainty, and pressure from other visible wars.

Scores are decision aids, not combat win probabilities. A house can recognize a powerful rival while declining an unsupported invasion. Before launching, it checks the actual available force against observed resistance and prepares a sufficient company. If the preferred front is unsuitable, it can consider another known opening, recruit, expand, or scout. It does not receive troops or resources for choosing a plan.

The original Grand Host, Flanking Raiders, Siege Column, Bastion and Counterattack, and Banner Guard tendencies remain. Adaptive intent adds opportunistic invasion, counterweight action against a developing leader, expansion, raiding, siege preparation, defense, objective play, and recovery. Intent can overlap with a house's original tendency: a siege house can defend its capital, and an aggressive house can recover after a defeat.

Healthy committed companies retain workable missions. Commitment periods discourage target switching; immediate danger, observed losses, an invalid or completed mission, and an untenable attack permit reconsideration. Raiders can withdraw from overwhelming visible pressure. Siege commanders check support and can use escorts when an enemy threatens their artillery. Warlord can send a second raid when a real surplus remains, the smaller raiding force can support the attack, and the main company and garrisons stay intact.

Castles retain defenses, including small persistent guards at remote owned castles. A rebuilding house recruits and regroups before another major attack. Neutral ruins, territory and crossings remain useful campaign goals; activity does not require every house to attack continuously.

## Information and fairness

With fog disabled, the existing complete campaign knowledge remains available. With fog enabled, the campaign assessment reads visible information, legitimately shared allied sight, and frozen scouting memories. It does not read hidden enemy gold, troop counts, private upgrades, orders, realm totals, construction, damage, deaths, or movements. A hidden defeat does not magically remove a remembered target.

Visible hostile observations are copied into immutable records before a campaign report is cached. Losing sight therefore cannot leave a live reference that follows a hidden army or silently updates a castle's health. Tactical target acquisition continues to use currently visible units; campaign memory does not let a unit shoot or pursue a hidden soldier.

Mobile observations lose confidence with age and expire after 120 simulation seconds. Building confidence also falls with age. A new offensive against a building last seen more than 45 seconds ago requests reconnaissance before committing. Seeing an old army position empty disproves that position without revealing where the army went. Old building and territory information remains deliberately stale until scouting confirms a change.

Allied houses share reconnaissance through the existing alliance vision data. Observed ownership changes and castle conquests provide evidence of expansion and victories. A castle's last observed holder is retained through a neutral ruin, so a replacement keep with a new building ID can still establish a confirmed conquest. Hidden ownership changes do not create reports.

Static troop definitions and observed health describe known military strength. A visible elite troop can count differently from an ordinary soldier. Hidden changes to its house's weapons or armor do not change a remembered estimate.

The Council already exposes alliance flag scores and cumulative Crown Control time. Those public scores can affect strategic priorities under fog. A hidden standard's current controller, capture progress, contest state and cooldown remain private.

## Difficulty and victory modes

Difficulty changes preparation, coordination and response. Starting armies and gold, house strengths and weaknesses, prices, supply, combat, movement, and recruitment rules remain shared.

| Setting | Decision interval | Campaign review interval | Base first-offensive readiness | Intent commitment | Recovery period | Supported fronts |
|---|---:|---:|---:|---:|---:|---:|
| Easy (`relaxed`) | 4.6 s | 12 s | 65 s | 38 s | 32 s | 1 |
| Normal (`standard`) | 2.5 s | 8 s | 38 s | 30 s | 24 s | 1 |
| Hard (`veteran`) | 1.4 s | 5 s | 30 s | 26 s | 18 s | 1 |
| Warlord (`warlord`) | 0.9 s | 3.5 s | 22 s | 24 s | 14 s | Up to 2 |

These are base parameters, not promised attack times. House tendencies, initial staggering, available soldiers, defense requirements, travel, objectives and scouting can delay an offensive. Survival can override a commitment. Hard and Warlord use lower thresholds for noticing a developing threat or a clear opening; they do not gain secret vision or free units.

Castle Conquest and Dominion retain their castle and territory priorities. Bannerfall and Blitz Flags prioritize captures; Crown Control prioritizes the central standard and its public cumulative score. The team versions preserve alliance objectives and allied coordination. Defend the King retains protected, irreplaceable kings, central reinforcement flags and hunting of observed enemy kings. A king is not absorbed into an ordinary offensive company. Allies are excluded from invasion candidates, and an observed target becoming allied invalidates the attack.

Explicit player orders, local engagement and pursuit limits, unit combat behavior, formation controls and legal crossings remain part of the existing command and movement systems.

## Focused validation and campaign observations

The new intelligence suite covers comparable dominant player and AI houses; weak-house opportunities; immediate defense versus a distant threat; hidden-state invariance; frozen cached observations; mobile memory decay and rescouting; known elite strength; allied sight; public versus private objective state; observed and hidden conquests; and the risk of another visible war.

The living-rival scenarios exercise committed orders, emergency recall, rebuilding after losses, remote garrisons, reconnaissance before a stale invasion, a supported Warlord second front, all nine supported victory modes, unsupported-attack preparation, an actual counterweight deployment against comparable AI and player leaders, and legacy plan migration. The existing movement, combat, capture, fog, controls, formation, rendering and performance checks remain part of the verification commands below. Final verification is recorded below.

There is no general persisted campaign save/load API in the maintained app; Resume retains the current in-memory campaign. Older in-memory AI plan objects acquire the new optional fields lazily. The legacy-plan test removes the new fields from a deployed plan and verifies that its existing company and target survive migration. This is compatibility coverage for the supported plan shape, not a claim to have loaded historical save files.

### Natural opening campaigns

The natural run used seed **44277**, Continent/Riverlands, Castle Conquest, 15 rivals, fog off, an idle player, and fixed **1/30-second** simulation updates. It started normal campaigns without teleporting troops, adding forces or resources, jumping campaign time, or repeatedly resetting orders. Every case ran for 120 simulation seconds. Wall time is workload metadata and is not a performance comparison.

| Activity across the first 120 s | Normal | Hard | Warlord |
|---|---:|---:|---:|
| Mission launches | 16 | 20 | 22 |
| Houses launching a mission | 15 | 15 | 15 |
| Mean troops assigned to offensive/objective missions | 304.87 | 323.12 | 346.82 |
| Peak troops assigned to those missions | 655 | 651 | 636 |
| Mean troops near held keeps | 1171.45 | 1143.88 | 1107.20 |
| Fewer-than-five-near-home house-seconds | 0 | 0 | 0 |
| Recorded kills | 395 | 372 | 420 |
| Standard captures | 3 | 2 | 2 |
| Winner within the observation window | None | None | None |

Warlord produced **13.8% more mean assigned objective pressure** and 37.5% more mission launches than Normal in this seed. Hard's corresponding mean was 6.0% higher than Normal. These observations establish earlier or more sustained activity in this opening, not a win-rate improvement. Kills and captures did not improve monotonically with difficulty.

All observed offensive missions in this window sought ruins or standards. There were no castle assaults or completed ruin restorations, so this run does not establish late-campaign invasion variety, supported siege success, or campaign-long challenge. Several adaptive intents appeared, but a role label alone is not evidence that the matching action succeeded.

The near-keep count includes living non-assault/raid/pressure troops physically within 13 tiles of a held keep; it is broader than formal garrison assignments. The low-defense measure counts living AI houses with at least 20 troops and a keep but fewer than five such nearby soldiers. It does not prove every front was safe.

The raw run's last periodic snapshots were at 91 seconds: 16 living houses in every case, 2010/1947/1959 living troops, and 497/335/362 troops assigned to objective missions for Normal/Hard/Warlord. The original periodic snapshot gate missed the exact final boundary because summing 3600 floating-point steps produced slightly less than 120. Final integrated metrics, kills and scores still cover the full run. The reusable harness now uses an epsilon-safe gate and records an explicit final state.

## Performance investigation and bounded claims

The comparison baseline is commit **`9a43126837d1b1bd4abbee7c90ec5ef250ab9eed`** (`9a43126`). Measurements use the same machine: AMD Ryzen 7 5825U, 16 logical processors, Windows build 10.0.26200, Node 24.19, and Edge 157. Browser comparisons use **1400 × 900**, device pixel ratio **1**, and **High** graphics. Seeds, scenarios, warm-up and sample counts must accompany each final result.

Simulation CPU, renderer CPU, browser frame intervals and input-to-next-frame latency are distinct measurements. Native raster timings are also distinct from browser drawing. Synthetic late fixtures add late-scale armies or contested objectives to a seeded map; they are useful workloads, not naturally played late campaigns. AI-enabled comparisons change decisions and therefore cannot be treated as deterministic optimization-only comparisons.

The existing shared navigation, legal routes, fixed simulation steps, spatial and territory behavior, cache limits, troop counts and visual detail remain constraints. Optimization-only comparisons use state digests where practical. No reduction in army size, combat work, movement rules, controls or intended visual detail is credited as an improvement.

Two targeted measurements support narrow changes:

- Reusing the same stationary woodland scenery reduced **native drawing median from 32.38 ms to 5.90 ms**. This result applies to that native workload. Browser checks of the corresponding inexpensive case were approximately at parity; it is not evidence of the same browser speedup or a whole-game FPS gain.
- Skipping irrelevant house/action aura checks reduced a **672,000-call microbenchmark from 53.79 ms to 15.66 ms**, with matching return values. Eight optimization-only simulation cases retained matching state digests. Active aura queries remain live; this supports the early rejection of irrelevant checks and deterministic preservation in those cases; it does not establish an equivalent full-frame speedup.

### Final simulation comparison

The original game at 9a43126 and the finished implementation were measured sequentially on the same machine. All values below are milliseconds, original → current. Seed 44277; 15 rivals; Riverlands; Warlord; fixed 1/30 s; 20 warm-up updates and 80 measured updates per scenario. These are small repeatable samples, with normal operating-system and thermal variability. AI-enabled outcomes intentionally differ from the original game.

| Map / workload | Mean update | p95 update | Maximum update |
|---|---:|---:|---:|
| epic / idle | 6.98 → 5.43 | 10.46 → 7.75 | 12.65 → 11.06 |
| epic / march | 13.22 → 9.67 | 18.98 → 13.47 | 23.37 → 14.36 |
| epic / battle | 13.32 → 10.83 | 25.24 → 21.62 | 29.27 → 25.50 |
| epic / campaign | 16.34 → 13.60 | 23.51 → 22.35 | 45.34 → 39.25 |
| continent / idle | 8.98 → 7.77 | 12.93 → 10.44 | 19.07 → 11.56 |
| continent / march | 12.78 → 11.79 | 15.73 → 14.17 | 18.73 → 15.53 |
| continent / battle | 8.99 → 9.92 | 13.27 → 15.56 | 16.36 → 16.53 |
| continent / campaign | 12.24 → 12.11 | 24.52 → 22.67 | 35.57 → 49.63 |

Continent with fog enabled, otherwise matching settings:

| Workload | Mean update | p95 update | Maximum update |
|---|---:|---:|---:|
| idle | 7.24 → 8.16 | 13.15 → 16.34 | 13.97 → 21.88 |
| campaign | 18.04 → 16.53 | 36.26 → 35.55 | 53.32 → 59.54 |

### Whole-app browser comparison

Edge 157, headless, High graphics, 1400×900, DPR 1, seed 44277, Continent/Riverlands/15 rivals, 24 warm-up frames and 90 measured native RAF frames per scene. The real app loop, HUD, minimap, fixed-step simulation and player controls remain active. The late-march and late-campaign fixtures contain 4,480 troops; late-campaign keeps AI enabled. Invasion planning and contested Crown Control use 1,120 starting troops. These late fixtures are synthetic. The renderer is explicitly invalidated after installing each seeded fixture, so terrain artwork matches the tested map.

| Scene (starting troops) | Simulation median | Drawing median | Frame interval p95 | Frames >100 ms | H input → next frame median |
|---|---:|---:|---:|---:|---:|
| early (1120) | 8.40 → 5.40 | 5.30 → 3.80 | 17.20 → 16.80 | 0 → 0 | 14.00 → 19.50 |
| late-march (4480) | 34.70 → 38.10 | 5.10 → 5.80 | 66.70 → 83.30 | 0 → 1 | 46.50 → 64.80 |
| late-campaign (4480) | 50.60 → 46.70 | 5.00 → 4.90 | 100.30 → 83.40 | 6 → 3 | 85.00 → 61.70 |
| invasions (1120) | 12.70 → 13.90 | 5.00 → 5.00 | 66.60 → 33.40 | 0 → 0 | 23.90 → 18.00 |
| objectives (1120) | 30.30 → 18.90 | 39.50 → 25.40 | 116.70 → 83.20 | 15 → 2 | 76.90 → 56.00 |
| woodland (1120) | 7.10 → 6.50 | 7.80 → 9.70 | 33.30 → 33.20 | 0 → 0 | 15.20 → 16.90 |

All trusted H-key probes preserved the surviving selected player's Hold orders during AI planning. Each scene has only three input probes: this is a control/responsiveness smoke measurement, not physical-device latency or a statistically broad latency study. Raw evidence also includes p95/max simulation and drawing time, maximum frame intervals, and frames above 50 ms.

### Verified optimization scope and remaining costs

The initial new assessment performed 885 separate route searches in the Continent campaign fixture. A controlled consecutive comparison of that new AI before and after optimization reduced 55 AI calls from 2,396.84 to 446.28 ms total, maximum call from 214.25 to 37.24 ms, and route searches from 885 to 15. This isolates the cost of the new assessment; the original-game comparison is in the tables above. The finished assessment reuses a legal terrain survey from each house's origin, evaluates every known target, and reuses report-local observed strength and crossing-risk calculations. It does not discard distant houses or reduce military decisions to a shortlist. Terrain-only caches are bounded by navigation revision, origin and movement class; extra source grids are capped at 32, retained routes at 1,024, and route point records at 65,536. Moving scouts continue to use their existing routes.

The independent hero-helper optimization preserves all eight original simulation digests. The report also includes a before/after comparison of the new AI around the route optimization; its scope and exact parity results are recorded in the accompanying JSON. Equal seeded digests are evidence for those fixtures, not a universal proof over all campaign histories. Weighted-route, crossing, disconnected-region and terrain-invalidation cases verify route legality and comparable costs.

The stationary woodland cache's native median improvement (32.38 → 5.90 ms) is backend-specific. The browser's inexpensive drawing path stays uncached: paired direct/adaptive tests on seeds 44277 and 628410 retained 16.7 ms median frame intervals, with noisy drawing medians and no demonstrated browser renderer speedup. Panning uses the existing drawing path. The cache retains the same artwork and device-pixel sampling; native tests allow at most one color-channel level of premultiplied-alpha rounding.

Large-army, dense-combat and fog-enabled workloads still show spikes. Whole-app results are mixed: late-march frame p95 rose from 66.7 to 83.3 ms and woodland drawing median rose from 7.8 to 9.7 ms in this run. Late-campaign p95 fell from 100.3 to 83.4 ms, while the contested-objective run fell from 116.7 to 83.2 ms. These short samples do not establish the cause of every difference. No universal FPS improvement or lag-free campaign is claimed. The app's existing simulation budget can slow campaign advancement under sustained overload while retaining fixed combat steps. Graphics quality and troop counts were held constant, and this update does not reduce visual detail to improve the measurements. Initial artwork loading and complete human-played campaign win rates were not benchmarked.

### Final verification and evidence

Syntax checks, 504 gameplay/performance checks, 90 native rendering checks and 33 browser checks passed, with no skips. Browser checks covered formation/placement controls (12), responsive persistent minimap behavior (15), hero controls (5) and offline standalone loading (1). The existing rendering suite exposed a missing king gold health bar in the original game; that display is restored. The crossbow browser fixture now waits for the existing aiming phase and counts actual shots rather than a cancelled animation record. Wave execution fixtures deploy the same enemy soldiers away from their keeps to provide a genuine invasion opening while preserving cohort, retreat and defense assertions.

The natural opening campaigns above were recorded before the final survey optimization. They establish the stated activity observations for that run; the focused and deterministic route checks do not turn them into a full late-campaign or win-rate study. No test failures are knowingly left unresolved. Evidence files are in [performance-evidence](performance-evidence/); local machine paths have been replaced with workspace labels.

## Repeating the checks

Run commands from `games/bannerlands`. Node is sufficient for the simulation and gameplay checks. Rendering needs `@napi-rs/canvas`; browser checks need Playwright and a compatible Chromium browser. Dependencies can live outside the checkout. If they are not resolved locally, set `LANDS_CANVAS_MODULE` to the canvas package path, `CODEX_PRIMARY_RUNTIME_NODE_MODULES` to the dependency `node_modules` directory, and `BANNERLANDS_BROWSER` to the browser executable. Keep those dependency and browser choices the same for both versions.

```sh
npm run check
npm test
npm run test:render
npm run benchmark:render

node source/tests/performance.mjs --scales epic,continent --scenarios idle,march,battle,campaign --frames 160 --warmup 40 --output simulation-current.json
node source/tests/performance.mjs --scales epic,continent --scenarios idle,march,battle,campaign --frames 160 --warmup 40 --fog true --output simulation-fog-current.json

node source/tests/campaign-performance-browser.mjs --frames 120 --output campaign-browser-current.json
npm run test:visual-performance

node source/tests/campaign-soak.mjs --seconds 120 --seeds 44277 --difficulties standard,veteran,warlord --scale continent --landscape riverlands --modes conquest --output campaign-soak.json
```

For a complete baseline simulation comparison, prepare a separate checkout at `9a43126` and pass its `games/bannerlands/core.js` to the current simulation harness using `--module`. Keep that baseline module tree intact. The browser campaign harness accepts the corresponding game directory through `--root`; run that directory and the current directory with identical frame counts and settings. For isolated renderer comparisons, `LANDS_RENDER_BASELINE` selects a baseline `render.js`; that harness deliberately feeds both renderers identical current simulation fixtures. This is a renderer comparison, not a whole-app baseline comparison.

Additional gameplay/browser commands are `npm run test:formations-browser`, `npm run test:mobile`, `npm run test:reinforcement-browser`, `npm run test:minimap`, `npm run test:painted-browser`, `npm run test:heroes-browser`, and `npm run test:hero-art`. Build and verify a standalone artifact with:

```sh
node source/build-standalone.mjs <output-directory>
node source/tests/standalone-browser.mjs <output-directory>/Bannerlands.html
```

These commands describe repeatable checks. The result tables use the explicitly recorded sample counts; the longer commands above can be used for additional sampling.
