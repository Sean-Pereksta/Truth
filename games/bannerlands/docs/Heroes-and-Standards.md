# Faction heroes and physical standards

Each army owns one original foot hero and one recoverable physical standard.
Two armies of the same house have separate identities and benefits. Hero
artwork replaces the common Commander in normal modes and Defend the King.

## Controls

- Click the small top-left painted portrait and HP bar, or press **F**, to
  select and center your hero. The portrait shows low health and the normal
  return countdown; a fallen king has no return countdown.
- Select the hero to reveal the contextual **Plant / Retrieve / Reforge
  Standard** button. **J** performs the same action. Mixed selections command
  only the hero. **Shift+J** retains its existing recruitment-building shortcut.
- Plant chooses ground with a validity footprint and benefit-radius preview.
  Retrieve walks to the existing object. **Refit** appears for a damaged carried
  standard. Reforge is available only if the original is destroyed or absent.
- **Escape**, Move, Retreat, and replacement combat orders cancel an interaction.
- **Form at Standard** opens the existing formation preview, preserving width,
  ranks and facing and reserving a center lane around the pole. Troops walk into
  real slots; the hero retains its own orders.
- Click a visible enemy ground standard to deliberately attack it. Ordinary
  target acquisition never redirects a formation toward a flag.

The selected-hero panel shows the painted portrait, signature weapon, current
standard state, HP, physical interaction progress, and benefit explanation.

## Physical rules

| Property | Rule |
| --- | --- |
| Plant | 3 seconds after travel and arrival |
| Pickup | 2 seconds after travel and arrival |
| Interaction reach | 0.6 tile, with a valid approach |
| Carried benefit | 3-tile radius around the living hero |
| Planted benefit | 5-tile radius around the fixed pole |
| Ground standard health | 300 HP |
| Keep refit / reforge | 8 uninterrupted seconds at the same living owned keep |
| Ordinary hero return | 35 seconds if an owned keep remains |

Planting and pickup suppress benefits and attacks during handling. A complete
painted interaction contains the pole while the standalone object is suppressed;
release transfers the same identity only at completion. Aborts retain the proper
carried or ground state. Pickup preserves health. Moving, hard displacement,
stun, death, destruction or loss of the required keep cancels unfinished work.
Ordinary hits do damage without continually restarting the timer.

Death drops a carried standard at the body or leaves a planted standard dormant
at its old position. The returning hero must travel to recover it, then plant it
again. An intact remote standard cannot be replaced. An absent or broken one
requires the full keep reforge. A hero without the standard can still use the
signature weapon and the house power. King death eliminates the army before
return logic and leaves its standard inert.

While carrying, the hero has a one-handed sidearm and stowed signature equipment.
Planting frees the hands for a shield, full-length polearm, two-handed weapon,
bow or crossbow. Stowed shields never protect the front. Signature crossbows use
stationary physical reload stages and actual target-facing checks.

## Benefits

`heroes.js` contains the authoritative sixteen named profiles and descriptions.
`hero-benefits.js` is the single benefit implementation. Effects belong only to
the owning army, exclude the hero and standard unless explicitly targeting a
building, and never stack with another allied army's source. Carried and planted
effects are mutually exclusive. Existing unrelated house traits and E powers
remain separate; superseded Dragon and Mormont Commander proximity checks were
removed.

Rate changes advance the existing reload, setup, aim or recovery clock; the same
work drives painted action selection. Entering a radius cannot complete a stage.
Projectile weapon bonuses are recorded at release, shields resolve at impact,
and melee and braced contacts resolve their bonus at the actual hit. Capture
bonuses change eligible progress without changing ordinary dominance tests.

## Painted artwork

`assets/heroes/{sigil}.png` contains a separately generated 8-by-8 transparent
raster atlas for each house: 64 frames, 1,024 authored cells in total. Each house
has its own painted portrait, equipment, silhouette, heraldic pole and cloth.
Carried flags are part of the complete hero frames. Planted, wind-idle, dormant,
fallen, collapsing and broken flag states are generated standalone artwork in
the same house atlas; the renderer never constructs a generic replacement flag.

`painted-heroes.js` maps action cells. `Renderer.loadPaintedHeroes` extracts alpha
bounds and foot/pole anchors without shrinking the person to fit long equipment.
The complete frame is mirrored horizontally for the opposite facing, using the
existing troop facing selector. There are exactly two visual facings, including
the spear and glaive heroes. World-facing vectors continue to govern weapon
contact, guard direction, turns and projectiles.

The renderer depth-sorts physical standards independently, suppresses them while
the complete interaction/death frame contains the same pole, and shows the
owner's distant standard through fog without revealing nearby enemies.

## Persistence and validation

Physical standards have an independent negative ID namespace, preserving the
existing positive troop/building ID sequence. `game.exportStandards()` and
`game.importStandards(snapshot)` serialize standard identity, owner, carrier,
health, world position, dormancy, interaction phase/progress, hero mode, issuance
history and return timer alongside the caller's world snapshot. Duplicate
identities are rejected before mutation. Formation crests and territory objectives
remain separate from physical standards.

Run `npm run check`, `npm test`, `npm run test:heroes-browser`, and
`npm run test:hero-art`. Browser tests accept `CODEX_PRIMARY_RUNTIME_NODE_MODULES`
and `BANNERLANDS_BROWSER` when Playwright and Chrome live in a bundled runtime.
`node source/build-standalone.mjs <destination>` embeds all sixteen hero and flag
atlases in the offline game.
