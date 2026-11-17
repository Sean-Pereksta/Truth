# Town activities

A painted sign at each venue opens its board. Move to the sign and use the current Interact binding. The camp coach can take the party to a venue. Practice is free and leaves the campaign wallet and mastery records alone.

| Venue | How to play | Local seats |
|---|---|---|
| Bellkeeper’s Tea Room, Mossbell | Play Lantern Lines against Nettle, Carver Briar or the visiting mouse tactician. Two opening studies teach how to deny a Signal and use a shove. | One seat per color on a shared board. The starting seat alternates across matches. |
| Quarry Ring, Goat’s Rest | Inspect the roster and payout, then enter the chalk ring. Move, strike and dodge a committed warning. The gate offers four bouts, equipment access and a trophy wall. | Each hero controls their own fighter. Stand close to a fallen partner for a revive. A cleared bout pays each active hero. |
| Shellbreak Bay, Crownrest | Race Lark to land the most fish in 105 seconds, or fish at your own pace for the market. Aim at a dock, cast, hook when the float dives, reel in slack water and ease off on heavy pulls. The hold-to-reel assist eases the line automatically. | Race the other angler by catch count, fish together for Lark’s commission, or choose a best-three weight contest on matching tides. Each line and basket belongs to one hero. |
| Switchyard Dispatch, Ashford | Route three stamped carts to matching platforms. Turnouts choose the direct track or the junction. Wrong platforms loop back. Dashed tracks preview movement. One rewind restores the preceding beat. | P1 sets the west turnouts. P2 sets the platform router and three stop signals. Both commit each beat. Changing a route clears both confirmations. |
| Windpost Trial, Kitehook | Steer through six numbered rings. Brace the line against gusts, release it before tension peaks and recover from mistakes at the last ring with a five-second penalty. | P1 and P2 fly alternating heats. P2 confirms the handoff. Matching course-position wind and an optional first-heat ghost allow a direct time comparison. |

## Inputs

D-pad or stick moves the menu cursor. A/Cross selects, B/Circle cancels a board selection or pauses a round. Start also opens the round menu. The owner selects **Return to town**, **Visit venue board** or **Replay** from the applicable screen. A disconnected assigned controller pauses the activity clock until its seat reconnects.

| Activity | A / Cross | X / Square | Y / Triangle |
|---|---|---|---|
| Lantern Lines | Select a piece, then a highlighted square | Choose a benched piece, or pass when forced | |
| Quarry Ring | Hold to strike the closest exposed rival in weapon reach | Dodge in the movement direction | |
| Shellbreak Bay | Cast, hook on the dive and hold to reel | Finish an untimed fishing session | |
| Switchyard Dispatch | Toggle the selected turnout or stop | Commit the next beat | Rewind one beat |
| Windpost Trial | Hold to brace the line | | |

Keyboard uses the configured movement keys, Enter to confirm, Space for the extra action, R for rewind and Backspace or Escape for the round menu. Solo also accepts arrow keys. With two local heroes, P2 uses their own movement bindings, Num Enter, Num 0, Num Decimal and Num Minus. The mouse can choose menu entries, click board cells and use the on-screen activity controls.

## Lantern Lines rules

Scouts step one square in any direction. Runners move one or two empty squares orthogonally. Wardens step one square orthogonally and can shove an opponent one square in that same direction. An occupied square beyond the opponent blocks a shove. A shove off the board benches the piece. Returning a benched unit to an empty home square takes the entire turn. A pass is legal only when no move or return exists.

The three lanterns sit at A3, C3 and E3. At the start of your turn, controlling two or three scores one Signal. Once either side reaches four, or after twelve complete rounds, the game compares scores after equal turns. Equal scores draw.

## Records, rewards and interruptions

The activity book is an additive part of the normal campaign snapshot and portable backup. The book stores first-clear crests, tiers, fish records, separate baskets, Lark’s commission, the best rail shift and kite time. It also stores the venue entrance during a round. Continue returns both heroes to verified walkable positions at that entrance. A dropped round preserves earlier banked progress.

Each landed fish immediately enters its owner’s basket. The three-species commission uses the shared illustrated journal. At the market, each hero receives the value of their own catch. The optional fishing race compares counts. Land eight in a timed race to earn the Shellbreak Creel. A personal best three totaling at least 7 kg also earns it, including for the runner-up. The separate weigh-in sums the three largest weights per line. Lark’s AI uses the same cast, hook, tension and landing rules as the player.

Results display any mastery equipment earned. A failed result save rolls back the provisional payout and gear and keeps **Retry saving result** available. Selling and commission settlement also retain the original balances on a failed save.

## Artwork

The illustrated venue views, field signs, board table, harbor water, carved playing pieces, anglers, animated fish, crates, kites and prizes load from the bundled `assets/activities/` directory. The open venues share the four-by-four `venue-pieces.webp` atlas of cream and indigo cat pieces, lantern, mouse tactician, fish, champion and quarry objects. Its sixteen equal crops use center-bottom silhouettes in a 1024-by-1013 transparent image. The sheet was generated for this release. `data/field-motion.js` records the fish and shatter crops. `data/tavern-frames.js` records the angler crops.

The fishing canvas draws a school from each bank’s actual tide and target state, moves the selected fish to the hook, and animates the landed fish out of the water. Only an off-board shove starts the shattered-piece sequence. Reduced-motion preferences replace the sequence with a bench label and suppress the board zoom.

## Verification

`node tests/town-activities.test.cjs` exercises the shared rules, AI, both opening seats, equal-strength mirrored scoring, bench and blocked shoves, board studies, switch ownership and rewind, clean solutions for all shifts, AI angling, independent lines, best-three scoring, deterministic six-ring heats and complete arena bouts.

`tests/activity-venues-browser.cjs` enters Switchyard, Quarry, Windpost and the bay through gamepad polling at 1280 × 720 and 1920 × 1080. Its 32 checks cover joint dispatch, rewind, banked payouts, retry, the P2 handoff, both heroes’ positions after Continue and both ways to earn the fishing award. Continue restores personal catch records and the earned gear. The test accelerates travel, the last hit in a fight and the approach to the final ring.

`tests/controller-venue-browser.cjs` covers both local board seats, the computer opponent, cast/hook/reel ownership, and reconnect using virtual controllers at 1280 × 720 and 1920 × 1080. Duration and seat-advantage tuning still need human play. These tests use a desktop browser and simulated Gamepad API devices.
