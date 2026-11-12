# Bannerlands · The War of Crowns

Command armies, conquer the grid, and unite the realm in an isometric real-time strategy game.

Ruined castles are major campaign objectives: Standard maps have 3 neutral ruins,
Epic maps 5 and Continent maps 6. Hold a ruin with 90% local troop dominance for
60 seconds to restore it. Contested or empty rings pause saved capture progress.
Every living castle adds 60 troop capacity beyond the ordinary territory limit;
restoring one immediately claims passable land within 8 tiles. Destroyed castles
become neutral ruins again. A faction survives while it has at least one castle,
and its home moves to a surviving castle if the original capital falls.

Bolton and Hightower can build dedicated siege yards for long-range trebuchets
that need 15 stationary seconds to deploy. Free Folk Giant Camps muster one
high-health giant with splash damage and knockback per 130 seconds; paid and automatic mustering
share each camp's cadence. Tully Sharpshooter Lodges train marksmen with longer
range and slower attacks than archers. Build these facilities with Shift+J and
recruit the extra regiment with U, Shift+6. Rival armies use the same facilities,
seek ruins, hold capture companies in place, and defend their castle network.

The new painted PNG sprite sheets, castle states and four production buildings
live in `assets/conquest/`; that folder also records their generation prompts.

The Lands Update adds Crownlands, Riverlands, Highland Marches, Shattered Coast,
and Kingsroad, alongside the original Open Realm. Rivers, five-lane bridges,
mountain passes, shallow fords, and roads change both army routes and lord strategy.
Choose a landscape in the campaign menu; the preview shows its actual geography.
See `docs/Lands-Update.txt` for movement rules and map details.

The performance edition reduces route-planning stalls, caches strategic scenery,
and limits capture checks to affected ground. House selection now uses sixteen
painted heraldic emblems. See `docs/Performance-Update.txt` for details.

The campaign menu keeps all sixteen houses, a selected-house profile, landscape
preview, and campaign settings on one desktop screen. Smaller screens use House
and Campaign tabs with the start and resume actions always available. House
details opens the full bonuses, weaknesses, and power guide.

Right-drag formation orders now set a destination and facing, including slower
backward marches. Frey spears and Bolton pikes anchor frontal defenses, while
rear cavalry charges retain momentum and hit harder. Mountains block direct
fire, woods give missile cover and hills extend archer range. Troop-type
shortcuts, nine command groups and letter-based building shortcuts are listed
in `docs/Combat-Update.txt`.

Stark, Lannister, Targaryen and Tyrell can train Shield Bearers from distinct
shield halls. Mormont, Martell and Arryn can train Lance Champions from their
own mounted academies. Each of these seven houses has a separate troop sprite
sheet with its own armor and colors, plus illustrated production buildings.
The new facilities unlock paid companies and train automatically under normal
supply and rally rules. River Rangers, Free Folk Berserkers and Ironborn Reavers
move 10% faster.

Lance Champions now have 400 base health and 18 base damage. Their charge remains
their strongest strike. Move orders improve disengagement with 30% extra speed,
faster turns and less crowd drag. Crowds still slow champions, but they escape more easily than ordinary cavalry. Retreat (V) returns champions to their
training facility’s rally, then their army rally or keep if needed. Rival
champions withdraw and regroup between successful charges.

Fog of war is an optional campaign setting. It shades visible terrain, hides
unseen enemy armies and preserves last-seen buildings. Allied sight is shared;
enemy commanders use the same information limits. Watchtowers reveal 12, 15
and 18 tiles by level. Cavalry Patrol (N) continuously scouts owned borders.
Left-drag selects troops; right-drag always sets destination and facing.
See docs/Fog-and-Scouting.txt for the complete rules.

Idle soldiers and cavalry patrols now engage nearby visible enemies, with
bounded pursuit and a return to their post or patrol. Capture companies fight
for contested ruins and flags. Explicit orders keep priority; ordinary Move
orders release automatic engagement after arrival, while facing orders and
Hold preserve the line. Fog of War is highlighted in the campaign menu with
clear On/Off choices and visible guidance.

The playable web entry is `index.html`. The current editable JavaScript, CSS, and artwork are beside it. Serve this folder over HTTP; opening the split-module entry directly with `file://` is unsupported.

- Local preview: `npm start` (http://127.0.0.1:4173).
- Syntax checks: `npm run check`.
- Gameplay regression checks: `npm test`.
- Repeatable large-army simulation benchmark: `npm run benchmark`.
- Optional native graphics checks: `npm run test:render` and `npm run benchmark:render`
  with `@napi-rs/canvas` installed or `LANDS_CANVAS_MODULE` pointing to it.
- Build a standalone offline copy: `node source/build-standalone.mjs <output-directory>`.

Controls, house details, and update guides are in `docs/`. The game was originally imported from the supplied Bannerlands folder; historical `Original/` backups and preview images are excluded. The source and artwork beside the web entry are the maintained version.
