# Exploration rewards and equipment

## Discovery and acquisition

Hidden assignments stay out of the open mission list until a standing hero approaches the contact within 230 world units. Speaking to the contact then uses the existing acceptance gate. No dialogue choice can permanently reject a reward. Nearby wayfinders include clues in their advice and cave-rumor conversations.

| Adventure | Discovery clue | Recommended level | Stages | Reward |
| --- | --- | --- | --- | --- |
| The Gunsmith Below | A hammer beside Owl's Grotto, Mosswood; Tinker Wick waits near the cave approach | 5 | Recover two separated cave-side parts; defeat the receiver's guard group; recover the receiver; return to Wick | Lanternline Rifle |
| The Last Watch | The lantern near Crystal Pass, Stonecrest; meet Warden Tallow at the ruined watchtower | 7 | Repair the signal; hold a 15-second broadcast; defeat the assault group and retrieve its orders; return to Tallow | Last Watch Armor |
| The Blackglass Trail | Violet survey ribbons southeast from Ember Rest; meet Scout Vesper | 19 regional recommendation (equipment requires 16) | Read two trail signs; defeat the reaver/mortar patrol; retrieve its route book; return to Vesper | Blackglass Pathfinder Armor |
| Orchard invasion | Captain Saffron | 1 | Complete and turn in the invasion | Signalstorm Carbine |
| Winter invasion | Medic Lumi | 10 | Complete and turn in the invasion | Breachmaker Shotgun |

The new exploration encounters use existing surface geography, including cave approaches; they do not add new dungeon interiors. The final recovery is blocked until the actual guard group is defeated. Each encounter uses three enemies in solo or four in co-op. A full enemy budget defers the entire group, never silently skips part of it. Blocked or displaced guards recover to nearby visible clear ground. There is no mandatory kill deadline.

## Equipment and effects

| Item | Level | Base stats | Special effect |
| --- | --- | --- | --- |
| Lanternline Rifle | 5 | 33 damage, 2.4 shots/s, 7 rounds, 1.8s reload, 950 range | Hits at least 0.55s apart build three focus stacks. Each prior stack adds 6% damage against flanked or recovering targets, maximum 18%. Missing or rapid fire resets the sequence. |
| Breachmaker Shotgun | 10 | 6 × 15 pellets, 1.3 shots/s, 4 rounds, 2.5s reload, 370 range | Pellets add 25% damage against shield/armored roles inside 150 units. Ordinary spread and shotgun falloff remain. |
| Signalstorm Carbine | 1 | 15 damage, 5.5 shots/s, 18 rounds, 1.65s reload, 690 range | Four hits on the same enemy within 2.5s mark it for 3s, increasing all incoming damage by 8%. Missing resets the hit sequence. Marks refresh rather than stack. |
| Last Watch Armor | 7 | 25% armor, +48 health | Dodge near an approaching hostile projectile to ready a 35-damage ward for 2s; 8s recharge. A completed defense also readies the finite ward. |
| Blackglass Pathfinder Armor | 16 | 15% armor, +28 health | Dodge to gain 12% faster walking for 2s; the next reload begun within 3s is 20% shorter. |

Each armor reward is one complete visual suit in the normal armor equipment slot. No extra pieces or hidden set bonus are needed. Firearms use existing forge reinforcement up to +10, with existing resource costs; suit reinforcement continues through the existing outfit armor rank. Special-effect values do not multiply with reinforcement. Existing gear, equipped slots and catalogue indices are unchanged.

All three guns have distinct original inventory art and fully illustrated equipped arms with visible trigger grips and supporting paws. The attachment sheets cover six existing outfit/fur combinations, matching navy/brass Last Watch sleeves, and dedicated charcoal/violet Blackglass sleeves for both heroes. Shoulder pivots remain attached through eight-way aim, recoil, reloading and dodging. Bullets and muzzle flashes begin at the measured illustrated barrel tip. Both armor suits use their distinct body sheets, including movement, hurt and defeated poses. Source artwork and full generation prompts are retained in `assets/resistance/`.

## Rewards, saving and validation

Every qualifying hero receives a copy, including a resting co-op profile. A later joining hero receives the campaign's already-earned unique rewards. `resistanceRewardClaims` on each hero records grants; duplicate turn-in or loading cannot pay twice. Rewards arrive in the pack and do not silently change the loadout. Existing discovery celebrations announce them.

Mission progress uses the existing saved `missionRuns`; final guards keep stable IDs and health/max-health/scaling records, plus the existing active mission enemy snapshot. Missing streamed actors are restored instead of counted as killed. Temporary gear buffs and shot sequences clear on loading, defeat or travel; equipment and reinforcement remain.

Automated checks: full multi-stage quest interaction and normal turn-in in co-op; blocked recovery before real guard deaths; contact/objective terrain clearance; repeated guard streaming loss and save/load; complete-group capacity gate; active/resting co-op reward ledgers; focus/mark/ward/reload effects; PNG alpha and all icon/actor crop mappings. These are deterministic functional tests, not a claim of completed human difficulty testing of every optional quest.
