ACADEMY STANDARDS — THE BANNER TRIAL

PLAY
Open index.html in Chrome or Microsoft Edge, or visit its hosted address.
Keep the scripts, stylesheet, PNG artwork, and factions folder together.
The game works offline and needs no installation; the JavaScript is editable source.

YOUR GOAL
Lead House Augustus. Take a rival house's standard and escort the carrier back
to your castle to gain command of that house. Unite all ten houses to win.
Protect your own standard: losing House Augustus ends the trial.
Taking a flag requires an uninterrupted three-second grab. Stay beside the flag;
damage, enemy pressure, moving away, or cancelling the order interrupts it.
The marked flag and its progress indicator show exactly what is happening.
Once grabbed, a tall banner and carrier marker identify the student bringing it
home. Castles display their current ruler and clearly mark captured ownership.

CONTROLS
Left click or drag      Select students
Shift + select         Add students to your selection
Right click            Move / attack / collect / capture, depending on the target
1                      All students
2 / 3 / 4              Vanguard / Ranged / Support
Ctrl + 2 / 3 / 4       Save the current selection as a custom squad
F                      Follow your selected party
Arrow keys             Pan the map, including during tactical pause
Space                  Pause and plan / resume
A                      Attack move; then right click a destination
D                      Defend; then right click a position
E                      Escort a selected carrier with selected guards
R                      Recall the selection to your castle
B / T                  Place a barricade / trap with a ready engineer
Escape                 Cancel the current mode, close a panel, or open the menu

Use the compact minimap to move the camera; collapse it with its heading.
Use the fullscreen icon in the top toolbar or main menu to enter or exit
fullscreen. Escape also exits the browser's fullscreen mode.
Open the saved HTML directly in Chrome or Edge for fullscreen. Embedded previews
can block this browser feature.
The Equipment panel now offers Best gear · whole team as a one-click action.
For more control choose Current selection, Whole team or a saved squad, then
choose a role and review the exact changes before Apply. Individual checkboxes
build a group without Shift. Supply tabs separate weapons, armor, specialist
items and mounts; choosing a specific item previews assigning it to the group.
Empty slots are filled first, replacements return to supplies, and shortages
are reported. Automatic equipping upgrades available gear, uses spare mounts,
and keeps specialist jobs and forged weapons. Explicit weapon changes reset
the new weapon to forge level one. Recovering students are excluded.
The party heading opens individual students and custom squad assignment.

FOG AND PAINTED TERRAIN
Students and controlled castles share sight. Unknown ground is hidden; explored
ground remains dim when no ally can see it. Enemy units, carriers, supplies and
combat effects disappear outside sight. The minimap follows the same rules.
Woodland and ruins block long sight lines and conceal nearby troops; rocky
ridges block movement and sight. High ground extends sight. Marshes, woodland,
ruins, rivers and hills slow travel, with stronger penalties for cavalry in
wet ground and dense cover. Roads speed up movement. Routes consider terrain
cost, so troops can prefer a faster detour. Deep ponds remain impassable.
There are 23 forest groves, 14 hills, 12 marshes, 10 ridges, 12 ruins and five
road networks. All are painted image artwork from terrain-atlas-v2.png,
including road/river segments, reeds, stone slopes and ruins. Terrain & Tactics
in the help drawer shows the artwork and explains each terrain type.

STRATEGIC RIVALS
Explorer retains forgiving, simpler commanders. Tactician uses scouts, objective
plans, role counters, safe supply collection, defenders and healing. Veteran
coordinates squad rallies in cover, stronger reserves, banner escorts and
force-based retreats. Enemy plans use observed troops and expiring last-seen
reports, rather than tracking invisible enemies. Veteran has no extra damage
bonus over Tactician. Persistent orders preserve capture holds and attack
windups. Strategy memory is rebuilt from fresh observations after loading.

STRATEGY
Spears gain 75% damage against cavalry and briefly slow the target.
Cavalry deals 30% more damage against archers.
Shields block frontal arrows more often than shots from the side or rear.
Flanking heavy infantry reduces its effective armor and grants 20% more damage.
Rally, Arsenal, Sanctum and Forge sites provide distinct army bonuses.
Capture progress is capped, visible, and pauses while enemies contest the site.
Attacks have a visible windup and strike. Damage is checked when the strike
lands, so an enemy who leaves melee range can dodge it. Arrows visibly travel
after release. Watch the impact flashes, shield blocks and missed strikes.

SAVED TRIALS
The menu can save a trial in this browser and resume it later. Autosave runs
every 30 seconds of active play when browser storage is available.
Browser storage can differ between file locations and browsers. Use Export save
to keep a portable save file, then Load a save to restore it.

ART AND SOURCE
Each of the ten houses has its OWN raster sprite sheet with unique armor,
headgear, clothing, weapons, shields, and cavalry. Every sheet contains eighty
frames: idle, walking and attacks, front/back views, across five troop types.
The files are in factions/. Use faction-frames.json for exact frame rectangles
and drawing anchors; it accommodates the artwork's individual spacing.
Recruited students retain their original house artwork with blue allegiance
rings. Painted ground textures and a scenery atlas supply trees,
rocks, crates, shrines, blacksmiths, and castle keeps.

The source package includes the editable HTML, styles, engine, renderer, assets,
art prompts, and regression checks. Artwork was made with built-in image
generation. The new terrain atlas prompt is in terrain-art-prompt.txt.
Prompts are retained in the *prompt*.txt files.

The main game is mouse-and-keyboard focused. Touch-only controls are not included.

VALIDATION
Run all automated checks with:
node --test games/academy-standards/tests/*.test.cjs
The tests exercise terrain movement and routes, shared sight and exploration,
hidden-unit rendering and UI, equipment previews and inventory conservation,
and coordinated Veteran behavior in a seeded 30-second engine simulation.
DOM fixtures validate behavior; they do not validate browser layout.
