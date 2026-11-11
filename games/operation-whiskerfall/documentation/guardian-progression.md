# Shorter Ironhide rolls and regional cave guardians

Ordinary **Ironhide Roller** travel is reduced by **13%**: the previous 1,450–1,850 world-unit run becomes 1,261.5–1,609.5. Its speed, 0.52-second warning, ricochets, swept collision and 0.7-second dizzy recovery are unchanged. This adjustment does not shorten Gravelback's guardian rolls.

Guardians now learn a new technique every two regions. Each begins its rotation with its basic attacks, then introduces the techniques available at that depth. All three health phases remain, with the existing phase-specific variations.

| Family | Greenfields / Mosswood | Stonecrest / Frostmarch adds | Sunscar / Reedwater adds | Emberworks / Blackbanner adds |
| --- | --- | --- | --- | --- |
| Gravelback | Armored roll, faultline slam | Rock fan | Expanding fault ring, with a safe center | Separately warned chain rolls |
| Gloamwing | Committed swoop, icicle fan | Staggered falling icicles | Frost Roost: one locked slowing patch | Crosswinds: two separately warned, fixed-direction ice fans |
| Mother Briar | Venom bloom, web snares | Bounded brood summons | Aimed venom fan | Two staggered venom circles, locked at the start |
| Hollow King | Marked emergence, void fan | Burrow rift | Royal Echo: two delayed seals, locked at the start | Expanding royal rift ring |

Each guardian attack has at least a 0.75-second windup. Delayed circle strikes allow at least one second before impact. New attacks retain at least 0.8 seconds of recovery after their scheduled strikes. Fixed circles and fan directions do not chase a dodging player. A ring attack is safe inside the expanding ring, and dodge protection works through the ordinary damage system. No new move adds an overall encounter timer.

The original solo guardian health curve already rises from 1,000 to approximately 11,848 across the campaign, so it remains intact. Damage gains an additional 2% per region, reaching 14% in Blackbanner. A cavern first encountered with two active heroes records a 25% health increase; resting or rejoining the partner does not repeatedly scale or heal that guardian. Progression state is saved per cavern. HP is reconstructed from canonical definitions and retains its current percentage when migrating, preventing repeated save/load or checkpoint scaling.

Brood minions use explicit **85 + 35 × region** health (25% more in a recorded co-op cavern), **10 + 3 × region** base damage, and the existing five-minion cap. This removes an accidental second regional health multiplier and ensures their damage comes from their authored brood value. Ordinary world enemy balance is unchanged.

The extension uses the existing illustrated guardian artwork with canvas warnings, ice projectiles, poison circles and annular effects. New effects carry the existing guardian ID so leaving, reloading or defeating the guardian clears them. Defeated guardians and claimed relics remain defeated and claimed.

Load `js/core/guardian-progression.js` after the other combat and checkpoint extensions. Automated tests cover the shorter actual roller movement, all family rosters, canonical scaling, checkpoint resets, injured save/load/reentry, co-op persistence, and existing one-time loot flags. Additional independent combat tests exercise warnings and actual impacts. These checks do not replace human controller playtesting.
