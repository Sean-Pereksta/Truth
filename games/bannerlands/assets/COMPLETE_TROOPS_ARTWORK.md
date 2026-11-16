# Complete troop animation artwork

`../complete-troops.js` is the editable vector artwork source. Every published
cel starts on an empty transparent canvas and contains the complete body, hands,
clothes, armor, weapon and any usable carried shield. The battlefield draws the
result once; it never adds equipment, articulated arms or reload mechanisms on
top of an old soldier sprite. Siege machines, giants and engineers retain their
existing complete PNG artwork.

The priority designs include River Rangers, Sharpshooters, Hill Huntsmen,
Tollhouse Crossbows, Horn Hill Halberdiers, Vale Sentinels, Winter Pikemen and
Thornwall Pikemen. Shared whole-cel handling also covers the rest of the human
and mounted roster, including shield bearers, lancers and javelin throwers.

`AUTHORED_TROOP_POSES` defines complete ready, travel, backward, advance, turn,
lower, brace, thrust, recovery, hit, death, aim, release and support body poses.
Crossbow lower, span, take-bolt, seat-bolt and raise cels use distinct belt,
stirrup/lever, windlass and compact-lever mechanisms. Bows draw the string during
the simulation's pending shot, and the arrow is absent from its release cel.
Thrown weapons leave the hand at release and are retrieved in recovery cels.

`AUTHORED_BODY_VIEWS` contains sixteen front, rear, side and quarter body views.
The polearm roster uses all sixteen; other affected troops use eight. Shoulder
depth, chest/back armor, cheek and helmet direction, arms and weapon grips turn
together. A human stays at a 31-pixel authoring height. Weapon hulls expand the
cel around the fixed foot anchor instead of scaling down the soldier.

The shared equipment module supplies actual quantized facing, lowering extent,
thrust extension, shield presentation and projectile release point/height.
Core decides whether physical loading continues during a minor collision
shuffle; artwork consumes that state without a different movement threshold.
All graphics levels use these complete cels and the same pose timing.

Frames are shared in a true LRU cache with a 128 MiB byte budget. Analytically
authored body/weapon hulls allow direct rasterization into small canvases without
runtime image readbacks. Fixed specialist palettes and invariant pose cels are
shared across units. `completeArtCacheInfo()` exposes frame/byte counts and
hit/miss counters for performance checks.

Winter Pike Hall and Thornwall Drill Hall use separate complete vector
illustrations with pike drill racks and house architecture. Their portraits and
the troop portraits are rendered from the same artwork used in battle.

To regenerate review sheets, provide `@napi-rs/canvas` (or set
`LANDS_CANVAS_MODULE`) and run:

```
node source/author-troops.mjs path/to/review-output
```

The generator writes priority, crossbow-sequence and sixteen-direction polearm
contact sheets plus a pose manifest. `source/tests/complete-troops.mjs` verifies
1,360 long-weapon cels, including actual transparent alpha borders on every edge,
stable body scale, all eight redesigned identities and distinct pike halls.
