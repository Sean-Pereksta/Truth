# Expedition equipment

All four equipment rewards are obtained by completing and turning in their named expeditions. Every active, resting and later-joining hero receives one copy. Rewards enter the pack without changing the loadout. Each hero’s `expeditionRewardClaims` ledger prevents repeat payouts, including after saving/loading. Existing item and weapon catalogue indices remain unchanged.

| Reward | Quest | Level / rarity | Stats and effect |
| --- | --- | --- | --- |
| Winter’s Whisper | A Breath Beneath the Ice (`rare_rimeglass`) | 12 / Epic | 22 base damage, 3.2 shots/s, 12 rounds, 1.9s reload, 800 range. Four accurate hits freeze an ordinary foe for 1.1s, with 4s target immunity. Bosses are chilled instead. |
| Ember Bastion Armor | The Furnace That Wouldn’t Die (`rare_cindercoil`) | 14 / Epic | 28% armor, +60 health. Actual HP loss activates 20% incoming-damage reduction for 2s; 12s recharge. The triggering hit is not reduced by the new brace. No healing or lasting immunity. |
| Galeweave Mantle | The Wind Remembers (`rare_zephyr`) | 17 / Epic | 18% armor, +36 health. A completed reload grants +20% damage to the next successful shot or full volley within 3s and +15% walking speed for 2s; 8s recharge. Cancelled reloads, failed shots and forced movement do not exploit the effect. |
| Sea Beast Armor | The Beast Beneath the Crown (`rare_kraken`) | 24 / Legendary | 30% armor, +85 health. Three separate landed firearm shots on one foe summon a tentacle for 40 base damage with ordinary hero firearms scaling and 1.5s chill; 6s recharge. Dodge leaves a radius100 ink pool for 2s that chills ordinary foes; 10s recharge. Bosses receive Grasp damage and ordinary modest chill, never immobilization. |

Sea Beast is the sole armor reward for the optional Drowned Maw Kraken expedition in the Sunken Crown Isles. It is not a random drop. Its shell pauldrons, fins and tentacle mantle remain visible on both cat skins. Each armor is one complete suit in the existing armor slot; normal reinforcement applies while special-effect magnitudes stay fixed. Winter’s Whisper supports normal forge reinforcement through +10.

Temporary effect state is separate from saved player data. Loading, defeat, travel and co-op changes clear temporary powers. Switching suits clears their active bonuses while retaining their recharge deadlines during the same session. Grasp uses real projectile hit records, counts a whole shotgun volley once per target, and directly applies bonus damage so it cannot trigger itself recursively. Ink is low-opacity and never hides attack telegraphs.

`expedition-rewards.test.cjs` exercises append-only catalogues, quest-only grants to active/resting/future heroes, ledger roundtrips, actual HP-loss activation and expiry, same-frame reload-and-shot behavior, complete volley damage, cancelled reloads, weapon origin metadata, Grasp limits, bounded ink, and walking-only speed. `expedition-art.test.cjs` covers all nine bitmap sources and the actual rendering APIs. Source artwork, measured frames and complete prompts are in `assets/expeditions/`.
