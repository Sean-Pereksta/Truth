# Expedition artwork

Nine original PNG sources created on 2026-10-29 using OpenAI’s built-in image generation tool. The original source pixels remain unchanged. Full prompts and generation identifiers are preserved in `prompts.json`.

| Source | Use |
| --- | --- |
| emberbastion.png | Copper/obsidian/crimson modular suit, both cat skins, 16 poses |
| galeweave.png | Ivory/emerald coat and teal streamers, both skins, 16 poses |
| seabeast.png | Wild shell/fin/tentacle legendary trophy suit, both skins, 16 poses |
| winterswhisper.png | Ivory/silver/cyan freezing carbine inventory design |
| winterswhisper-arms.png | 14 illustrated two-paw grips: seven outfits × two fur colors |
| prism-sentry.png | Original slate-blue mouse/cyan projector enemy, eight combat poses |
| kraken.png | Nacremaw’s eight boss poses; retained version has wider transparent gutters |
| frost-breath.png | Original full-color ability card depicting directional freezing breath |
| aurora-well.png | Original full-color ability card depicting a friendly healing well |

Existing game armor, arm and enemy artwork supplied style/pose references; the new suit and weapon references guided matching gripping hands. No external artist assets or third-party images were copied. The Kraken source received one built-in image edit to improve spacing; the earlier crowded variant is not shipped.

`tools/measure-expedition-art.cjs` reads alpha without altering PNGs and writes `frames.json` plus the embedded runtime metadata. It records 81 source frames, measured floor anchors, armor shoulder joints, gun sleeve pivots and muzzle tips. Seven sprite/icon sources have actual transparent alpha; both ability cards are intentionally opaque. Hidden RGB under zero-alpha pixels can look colored in some viewers, but is not drawn by the game. Custom source rectangles preserve long dodge poses, the Sentry’s firing flash and the Kraken’s ink cloud.

All new firearm arms are finished illustrations with trigger and supporting paws. Winter’s Whisper has matching Scout, Ranger, Vanguard/Last Watch, Ember Bastion, Galeweave, Sea Beast and Blackglass sleeves for both cats. Existing firearms retain their illustrated arm system with the closest existing outfit row on new suits. Recoil/reload/aim rotate around opaque sleeve pivots, and projectile/muzzle flash origins follow the measured barrel tip.

The actual Canvas renderer was used for equipped and Kraken battle previews. Automated checks cover all source bounds/alpha, 48 suit poses, 14 gripping attachments across eight directions and four animation states, both enemy/boss pose sets, and ability cards/loadout thumbnails. This does not claim a completed browser/controller playthrough.
