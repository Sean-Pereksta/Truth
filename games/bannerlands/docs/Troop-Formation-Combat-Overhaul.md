# Troops, formations and equipment

The overhaul keeps the existing character-facing convention: one painted
screen-right orientation and its horizontal mirror. Formation fronts, pike
contact and shield coverage use independent simulation-space facing vectors.

## Painted actions

`painted-troops.js` maps troop/house identities to generated transparent raster
sheets in `assets/overhaul/`. Actions are complete character frames, including
weapons, hands and equipment. The renderer selects authored poses for movement,
backward steps, aiming, firing, loading, bracing, guard, impact and death.

Most sheets use four columns and four rows. A sheet with a different actual
layout declares its row column counts explicitly. Frame bounds are cached once;
body height determines battlefield scale. Long weapons retain their full image
area and foot registration instead of shrinking their bearer to fit a small
shared sprite box. Low detail continues using the same painted troop assets.

The eight new identities are River Rangers, Tully Sharpshooters, Hill Huntsmen,
Tollhouse Crossbows, Horn Hill Halberdiers, Vale Sentinels, Winter Pikemen and
Thornwall Pikemen. Existing long-weapon, crossbow and shield troops have separate
action coverage; their metadata is not an expanded directional art system.

## Orders

| Input | Command |
| --- | --- |
| Right-click | Move immediately |
| Right-drag | Move and choose final facing |
| Z | Form Up |
| D | Move & Face |
| Shift+D | Face in Place |
| H | Hold / Brace |
| W | Advance in Formation |
| A | Break Formation / Charge |
| V | Retreat |
| Alt+S | Select foot spears, pikes and halberds |
| 1–9 / Ctrl+1–9 | Recall / assign command group |

Form Up supports position, width, one through four ranks, facing and facing
lock. Its presets are Line, Pike Block, Shield Wall, Wedge and Loose. Enter
confirms placement; Escape cancels. Width and rank choices remain consistent
with the selected troop count. Pike Block and Shield Wall settle into a hold
after arrival. Defensive readiness still requires actual alignment and settling.

The mobile Form command uses a compact configuration sheet and battlefield
placement. Outside placement, normal camera dragging and pinch zoom remain
available. Contextual commands show Form, Hold/Brace, Advance and Retreat.

## Equipment rules

Stark's additional Shield Bearers become Winter Pikemen, and Tyrell's become
Thornwall Pikemen. Their pikes use both hands and provide no inherited heavy
shield reduction. Stark Winter Guard and the Lannister/Targaryen heavy shield
regiments remain. Legacy saves migrate the two replacement regiments and their
production buildings while preserving health percentage and continuing orders.

Pike interception requires actual swept horse/weapon contact, correct approach
direction, an unobstructed lane and per-soldier readiness. A planted spear needs
approximately half a second to lower and settle. Moving, turning and disrupted
soldiers lose full brace effectiveness. A discrete contact removes momentum from
the contacted rider; it is not a circular damage aura.

| Crossbow regiment | Base bolt damage | Reload | Cavalry multiplier |
| --- | ---: | ---: | ---: |
| Gilded Crossbows | 60 | 3.0 s | 1.8 |
| Tollhouse Crossbows | 72 | 3.6 s | 2.0 |
| Tully Sharpshooters | 100 | 5.0 s | 2.0 |
| Vale Sentinels | 64 | 3.2 s | 1.9 |

Loading progresses through lowering, spanning, retrieving a bolt, seating it and
raising the weapon. A move preserves completed stages and discards only the
unfinished stage's work. A loaded weapon stays loaded while moving. Projectiles
apply damage on impact, and the shared crossbow bonus applies once.

Shield protection uses the incoming hit direction at contact. Heavy shields
receive 25% of frontal missile damage, 35% of frontal melee damage and 45% of
frontal charge damage; side hits receive 100%, rear hits 150%. Smaller shields
use 60%, 75%, 80%, 100% and 125%, respectively. Frontal reduction requires a valid
guard. Poison, burning ground and area damage keep their separate rules.

## Validation and standalone packaging

Run the simulation and formation checks through the package scripts. Browser
checks use Playwright and a local Chrome/Chromium installation:

```text
node source/tests/formation-placement-browser.mjs
node source/tests/painted-art-browser.mjs
node source/build-standalone.mjs <output-directory>
node source/tests/standalone-browser.mjs <output-directory>/Bannerlands.html
```

`CODEX_PRIMARY_RUNTIME_NODE_MODULES` can point to a shared `node_modules`
directory containing Playwright; `BANNERLANDS_BROWSER` can select the browser
executable. `LANDS_RENDER_OUT` saves the actual rendered contact sheet and test
evidence. Automated pixel checks validate loadability, alpha, frame diversity,
state selection and mirroring. Painted quality, anatomical consistency and
weapon continuity also require direct visual inspection of that evidence.

The standalone builder follows local module imports in dependency order and
embeds the troop, building and environment images. Its `standalone-build.json`
lists included modules, images and final file size. The browser check opens the
built file directly and rejects external network requests.
