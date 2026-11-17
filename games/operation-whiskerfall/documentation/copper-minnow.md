# The Copper Minnow

Enter the painted tavern in Crownrest Haven through the harbor door. Inside, move either hero with their movement keys, stick or D-pad. Approach a patron or table and press A/Cross, Enter or the keyboard Interact binding. The bumpers or Tab walk to the next station. Click the floor to walk with a mouse. Leaving a conversation or game puts the hero back at their spot in the room.

Mae tends the bar, Lark talks about the fishing grounds and Pipkin shares advice about lanterns and darts. Each has three conversation choices. The painted room has three physically distinct draw tables, an oche and a harbor door. Its chairs, patrons and walkers are layered in depth. Character walk frames and poker expressions use the bundled face and walk sheets.

| Poker table | Ante and betting unit | Reserved per human | Opponent |
|---|---:|---:|---|
| Lark’s dock table | 1 coin | 5 coins | The angler calls often. His ears, whiskers and expression frequently reflect the strength of his cards. |
| Magpie’s brass table | 3 coins | 15 coins | The dealer raises good hands and sometimes gives a misleading look. |
| Pipkin’s velvet table | 5 coins | 25 coins | The visiting mouse occasionally bluffs. A clue to the hand appears briefly and less reliably. |

## Five-card draw

Sit alone against the resident player or invite both local heroes into a three-seat game. The screen lists the exact stake before seating. Each hero reserves enough campaign coins for the largest legal wager across the hand. Each seat antes one unit, receives five cards and gets an opening betting round. A player can check, open, call, raise or fold as the current bet permits. One raise per betting round caps exposure. On the draw, mark up to three cards to replace or stand pat. A final betting round leads to a showdown. The strongest conventional five-card hand wins, with ace-low straights and full kicker comparisons.

Tied winners divide the pot. An indivisible last coin goes to the first tied seat clockwise after the dealer button. Each hero's wallet receives their pot share and unused reserve. A player's face-down local hand is revealed only after that seat confirms possession of its controller. The dealer button rotates with each hand. On a shared TV, the other human should look away while their opponent views private cards.

The portable save includes the remaining deck, every hand, folded seats, current bets, draw phase, current seat, table-specific tell and paid result. The game saves the buy-in, each committed action and the settlement. Failed saves restore the preceding hand and wallets. Continue brings the party outside the harbor door. Re-enter and return to the same table to resume. The saved shuffled cards determine each tell, so leaving a menu or reloading does not reroll it.

## Darts

Aim at the board using the stick or movement keys. Hold Confirm to charge and release near the meter mark for accuracy. The singles, outer doubles, central triples and two bull regions score from the same geometry that is drawn. Each side throws three darts. Try the solo match against Pipkin or alternate throws with a local partner. Darts has no coin stake. The campaign records each participating hero's best score.

## Checks

`node tests/tavern-rules.test.cjs` checks all nine hand ranks, the wheel, kickers, tied pots and odd coins, seat ownership, legal draw limits, three different stake schedules, betting caps, deterministic tell persistence, differences in tell frequency and dart scoring. The same suite played 150 seeded computer hands through the shared betting engine.

`tests/tavern-browser.cjs` walked to tables and patrons with two simulated gamepads in Chrome at 1280 × 720 and 1920 × 1080. Each run passed 32 checks covering all three patrons, solo regular and expert poker, the easy three-seat table, local private-hand reveal, drawing, betting, wallet settlement, a failed buy-in, an injected failed bet write, Continue in mid-hand, restoring a paid result and six-throw solo and local darts matches. Travel to the exterior harbor door was accelerated.

`tests/coach-tavern-browser.cjs` also ran from a fresh title at 720p solo and 1080p local co-op. All 15 checks passed at each size. Controller inputs alone launched the campaign, opened Camp, rode to Crownrest, started fishing, returned, rode to the harbor door, walked to the brass table and sat down to play.

Gameplay captures show the [walkable taproom](media/copper-minnow-taproom.webp), [draw table](media/copper-minnow-five-card-draw.webp), [showdown](media/copper-minnow-showdown.webp) and [dartboard](media/copper-minnow-darts.webp).
