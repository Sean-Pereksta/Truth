# Bannerlands · The War of Crowns

Command armies, conquer the grid, and unite the realm in an isometric real-time strategy game.

Each house now fields its own painted hero and physical battle standard. Click
the small portrait and health bar at the top left to select and jump to your
hero, or press F. Selecting a hero exposes a contextual Plant / Retrieve /
Reforge Standard button; J performs the same action. Planting takes 3 seconds
after arrival, pickup takes 2, and damaged or destroyed standards can be refitted
or reforged at an owned keep in 8 seconds. Escape or a replacement order cancels
handling. Shift+J keeps its existing building shortcut.

All sixteen heroes and flags use generated painted raster artwork, including
house heraldry, carrying, interaction, weapon handling, and standalone flag
states. Artwork uses the same two views as the other troops: screen-right and
its horizontal mirror. Precise combat facing remains independent. See
`docs/Heroes-and-Standards.md` for benefits, controls, and validation.

Press Z to place a formation with chosen width, ranks, position and facing.
Line, Pike Block, Shield Wall, Wedge and Loose presets support a visible facing
lock. W advances the ranks; A releases them to charge independently. A plain
right-click moves immediately; right-drag chooses the final front. D opens
Move & Face, Shift+D faces in place, H holds/braces, and V retreats.

Stark Winter Pikemen and Tyrell Thornwall Pikemen replace their additional
Shield Bearers. Painted troop actions keep the original screen-right artwork
and horizontal mirror, while equipment uses precise logical facing. Pike
interception requires physical contact and settling; shields protect their
guarded front and remain vulnerable from behind. All four crossbow regiments
have powerful bolts and distinct stationary reload actions. Moving preserves
completed loading stages. See `docs/Troop-Formation-Combat-Overhaul.md` for
controls, equipment values, artwork contracts and validation commands.

Attacks on expanding troops now trigger local defense within aggro range while
distant troops continue their orders. Defenders pursue only locally and resume
expansion automatically. A / Break & charge considers both known enemy troops
and buildings by distance. Right-click a visible enemy building to focus attacks
on it until it becomes invalid or you issue another order.

Movement orders remain active when a right-click also closes a command panel,
and a right-drag that returns to its starting point still issues a Move order.
Large batches of destinations now preserve unfinished route searches instead
of repeatedly replacing them. Sparse collision-grid rebuilds and cached
territory artwork reduce work on large maps. See
`docs/Troop-Orders-and-Performance.txt` for details and validation.

The minimap is always visible in the battlefield corner. Command panels open
above it, and minimap navigation preserves the current panel. Buttons and
selected panel titles show opening shortcuts: Build (B), Muster (U), Orders (O),
Map (M), and More/Council (C). The map refreshes at a bounded six times per second.

The Battlefield Visuals update adds contact-timed attacks and reloads, blended
terrain transitions, small floating house-selection crests, and painted bridge
sidewalls. Cached scenery, lighter distant effects, and fewer repeated army
scans reduce avoidable drawing work. See `docs/Battlefield-Visuals.txt`.

The House Reinforcements update adds Stormbreakers with physical hammer knockback,
Saltwind Axethrowers, Tollhouse Crossbows, forest-fast Crannog Spearhands, and
long-reach Horn Hill Halberdiers. Martell replaces catapults with Sun Horse Archers
while keeping Lance Champions. Every new troop has a dedicated training building
and an eight-frame painted sprite sheet. Existing house weaknesses remain.
See `docs/House-Reinforcements.txt` for recruitment, combat and control details.

The Kings and Battlefields update adds cosmetic faction-colored casualties
that fade over two minutes, plus three landscapes: Twin Lakes, Mountain Crown
and Four Rivers. Defend the King pits four armies against each other with one
irreplaceable king each and recurring central flags that award reinforcements.
Crown Control rewards 120 seconds of central control; Blitz Flags is a faster
three-capture campaign. See `docs/Kings-and-Battlefields.txt` for the rules.

Ruined castles are major campaign objectives: Standard maps have 3 neutral ruins,
Epic maps 5 and Continent maps 6. Hold a ruin with 90% local troop dominance for
60 seconds to restore it. Contested or empty rings pause saved capture progress.
Every house starts with 280 troop capacity and one castle. Each additional held
castle adds 60: two castles allow 340 troops, three allow 400. Land, completed
Bannerlands, production buildings and upgrades do not raise troop capacity.
Territory still provides income and structure slots. Restoring a castle also
immediately claims passable land within 8 tiles. Destroyed castles
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

The battlefield fills the screen. A compact resource strip and five controls
open Construction, Muster, Orders, Map and More without reserving sidebar space.
More contains Council, realm objectives and settings. Portrait screens use a
scrollable bottom sheet; landscape screens use an on-demand side drawer.
Tap the same dock button, the close button or empty battlefield to dismiss it.
The first battlefield tap dismisses a panel without issuing an army order.

On touch, drag to pan and pinch to zoom. Tap a soldier and then a destination;
switch to **Drag: Select** for box selection. Construction and rally targeting
always keep drag-to-pan available. Choosing a building closes the drawer; tap
your land to place it, enable **Repeat** for multiple structures, or Cancel.
Selected buildings expose rally points and tower upgrades through their small
context strip. In Orders, **Assign selected troops** followed by a numbered slot
saves a command group; tapping a saved slot recalls it. Move & face accepts a
touch drag from the destination toward the intended front. Desktop shortcuts
and right-drag orders remain available.

- Local preview: `npm start` (http://127.0.0.1:4173).
- Syntax checks: `npm run check`.
- Gameplay regression checks: `npm test`.
- Optional mobile browser checks: `npm run test:mobile` with Playwright and Chromium available.
- Repeatable large-army simulation benchmark: `npm run benchmark`.
- Optional native graphics checks: `npm run test:render` and `npm run benchmark:render`
  with `@napi-rs/canvas` installed or `LANDS_CANVAS_MODULE` pointing to it.
- Build a standalone offline copy: `node source/build-standalone.mjs <output-directory>`.

Controls, house details, and update guides are in `docs/`. The game was originally imported from the supplied Bannerlands folder; historical `Original/` backups and preview images are excluded. The source and artwork beside the web entry are the maintained version.

Rival commanders now separate strategic threat, invasion opportunity, immediate
danger and campaign risk. Their current role adapts to objectives, visible danger,
scouting and losses, with commitment periods for workable orders. Hard and Warlord
make better use of the same information and resources. See
`docs/Living-Rivals-and-Performance.md` for behavior, validation and measurements.
