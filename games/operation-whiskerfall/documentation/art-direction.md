# Illustrated encounter art

The expansion follows the existing elevated, three-quarter adventure view: expressive animal characters, restrained dark outlines, readable material shapes, and consistent upper-left lighting. Enemy silhouettes, guardian scale, and mechanical states should remain understandable at normal gameplay zoom. Illustration supports the combat and puzzle rules; collision and hit detection continue to use world coordinates.

## Enemies and guardians

| Character | Visual identity and combat reading |
|---|---|
| Ironhide Roller | Rounded armor distinguishes the protected roll from the upright recovery pose. |
| Rift Stalker | A slim, spectral silhouette and violet arrival effects make the teleport destination visible before its strike. |
| Needleblade Fencer | A long, clear blade and forward fencing posture show the direction of a committed lunge. |
| Tunnel Fangrat | Low posture, claws, and earth effects separate burrowing from standing attacks. |
| Cinderback Beast | A broad beast silhouette and ember accents identify fire attacks and hazardous ground. |
| Venom Crown Rat | Green poison accents and a distinct head shape separate it from ordinary infantry. |
| Rimeplate Warden | Pale plated armor and cold effects communicate the heavier frost role. |
| Blackglass Knight | Dark armor with violet accents marks a dangerous late-region opponent. |
| Gravelback, the Iron Rat | A large armored body, tucked rolling form, and exposed recovery distinguish its vulnerable window. |
| The Gloamwing | A broad wing silhouette and icy effects separate its swoop from ordinary ground attacks. |
| Mother Briar | A wide spider silhouette keeps her poison pools and surrounding escape routes legible. |
| The Hollow King | A tall crowned burrower and marked emergence effect make the delayed arrival attack readable. |

The animation vocabulary includes idle, two locomotion poses, anticipation, two attack poses, recovery, and hurt. Runtime state selects the appropriate frame; the two attack images are not interchangeable with the warning pose. Facing and rotation use the intended character posture, with feet or the rolling body's center as the visual anchor. The actual attack radius and timings remain defined by combat code.

## Cavern architecture and devices

Floor textures establish the regional material, while rockwork, pillars, stairs, gates, braziers, and treasure props give rooms structure. Doors, corridors, the reliquary, and the return stairs must remain visually distinct. Decorative details do not create hidden collision or new puzzle rules.

Each puzzle pairs illustrated hardware with precise mechanical overlays:

- Rune stones retain distinct symbols and their ordered mural clue. Accepted shots illuminate progress; an incorrect shot visibly resets it.
- Mirrors retain an unambiguous reflective diagonal. The beam follows the actual reflection calculation from emitter to receiver, with restrained glow around a clear core.
- Pipe joints retain exact open ports. Only connected segments display the active water route; decorative highlights must not imply a connection that does not exist.
- Star devices retain numbered positions, connecting links, and the target light pattern. A shot changes the selected star and its two neighbors according to the puzzle state.

Survival rooms replace puzzle hardware with a watch altar, blue flame, and seal lamps. Camp encounters use a supply standard, defense gong, and barricades. Demolition sites show unarmed and armed charges plus the separate remote switch; text labels distinguish available, locked, armed, and spent states.

## Effects and readability

Beam cores, impact points, teleport arrivals, elemental particles, and warning rings belong to the same palette as their source. Particle accents may animate along a valid beam segment, but they must not suggest a second route. Warning geometry stays visible through effects and maps to the actual attack area. Low-alpha glows supplement silhouettes and labels rather than replacing them.

Transparent sprites retain genuine alpha. Frame bounds and pivots are measured from the supplied images and applied when drawing, preserving aspect ratio and preventing a neighboring sprite from entering the source crop. Opaque floor tiles are treated separately from cutout sprites. Review sheets at their source size and in the game: a polished full-size illustration can still be unreadable or clipped at gameplay scale.

## Provenance and maintenance

The new raster artwork was generated for Operation Whiskerfall with the image-generation tool. Original generated pixels are retained; the game uses metadata and draw-time fitting instead of rewriting the PNGs. Exact filenames, grids, dimensions, and source-frame bounds belong in the shipped art manifest. The renderer and `OW.Art` manifest are the authoritative mapping from gameplay roles to artwork.

When replacing a sheet, verify its alpha channel, populated frames, transparent gutters, pose order, and frame bounds. Recheck warning and recovery states, boss scale, puzzle port alignment, beam endpoints, relic visibility, and readable text at the normal camera zoom. Existing player bodies, separate weapon arms, and NPC art remain part of the same visual system.
