# Ability mastery and readable Fencers

This playable slice adds three ranks to five representative powers. Existing learned powers are rank 1. Rank 2 costs 1 skill point and requires the ability's unlock level + 1; rank 3 costs 2 more points and requires its unlock level + 3. The Skills card shows the current effect, exact next effect, cost and level before purchase. Learning and passive training use the same point balance.

| Ability | Rank 1 | Rank 2 | Rank 3 |
| --- | --- | --- | --- |
| Airstrike | 95 base damage; 155 radius; 18s cooldown | 109.25 base damage; 155 radius; 17.1s | 123.5 base damage; 178.25 radius; 16.2s |
| Medic Drop | 50% max-health healing; 330 reach; 20s | 60% healing; 355 reach; 19s | 70% healing; 380 reach; 18s |
| Shockwave | 80 base damage; 190 radius; 0.45s ordinary-enemy stun; 10s | 92 damage; 209 radius; 0.6s stun; 9.5s | 104 damage; 228 radius; 0.75s stun; 9s |
| Dashstep | 260 distance; 0.38s protection; 5s | 300 distance; 0.44s protection; 4.75s | 340 distance; 0.5s protection; 4.5s |
| Aegis Field | Absorbs 70% max health + 40; 8s duration; 17s | Absorbs 80% max health + 50; 9s; 16.15s | Absorbs 90% max health + 60; 10s; 15.3s |

Distances use existing world units. Damage still receives existing hero-level and training modifiers. Support training adds 20 healing per rank to Medic Drop's hero healing. Medic Drop ranks 2–3 also heal standing resistance NPC allies by the stated percentage, and their ring matches the healing reach. Shockwave's boss stun remains 0.08 seconds. Dashstep respects collision and sealed campaign gates. Aegis is a finite absorb pool, not invulnerability. Passive cooldown reductions and Spellweaver armor combine with the listed base cooldown.

**Reassignment:** Reset ability ranks in Skills for a full refund of only the points spent on these upgrades. This is free, retains learned powers, passive branches and equipped slots, and never clears a live cooldown. Each co-op hero owns their ranks and point balance independently. Resting Player 2 retains upgrades.

**Compatibility:** No item, ability index, save key or campaign-format version changes. Rankless saves remain rank 1 without granting extra points. Existing skill-book migration remains responsible for its earlier catch-up grant. `abilityRanks` is a per-player dictionary; `abilityRankVersion` records initialization. Invalid rank data is rejected before a save can replace a valid campaign. Swapping, buying, resetting and loading do not refresh per-ability cooldowns.

## Fencer counterplay

The Fencer now commits to a fixed amber lunge lane for 0.75 seconds before a 0.32-second charge. Sidestep the lane or land a blade hit during windup to interrupt. A 1.05-second stationary recovery, marked by a small green ring, takes 20% extra damage. Ordinary shots preserve the tell; a blade interrupt cancels the attack and its warnings. Stun/freeze extends the visible tell with the paused actor. Walls and campaign seals still constrain its movement. A Fencer defeat message identifies the lunge and its counterplay.

## Integration and validation

Load `js/core/ability-upgrades.js` after abilities, hero armor and UI extensions; load `js/core/readable-combat.js` after the existing combat extensions. Load `css/ability-upgrades.css` after the base stylesheet. No new bitmap asset is required: effects extend the existing spell geometry and canvas warning/ring system.

`node tests/ability-upgrades.test.cjs` exercises real ability effects, purchases, requirements, refunds, two-slot cooldown protection, co-op independence, legacy saves, resting-hero saves, repeated loads, invalid saves and UI actions. `node tests/readable-combat.test.cjs` exercises fixed tells, sidesteps, actual hits, real melee interruption, the damage bonus, freeze-delayed warnings, collision, defeat feedback and harmless rendering.

These automated checks are not a substitute for human controller and class/build playtesting. The other 19 active powers retain their existing learning and effects in this slice.
