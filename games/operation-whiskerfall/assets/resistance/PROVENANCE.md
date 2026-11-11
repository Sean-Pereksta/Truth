# Resistance adventure equipment artwork

Created 2026-10-29 with OpenAI's built-in image generation tool. All seven retained images are original generated game artwork; no third-party image assets were copied. Existing game artwork was visually inspected for style and scale, not supplied as an edit target for the first five originals. The two later gripping-arm sheets use the existing game arm sheet and these original guns/armor as visual references.

| File | Purpose | Original generation ID |
| --- | --- | --- |
| lanternline.png | Lanternline Rifle inventory art and design reference | exec-20b5718b-a462-4b65-a53b-0d4382e6d25d |
| breachmaker.png | Breachmaker Shotgun inventory art and design reference | exec-70e74bb5-0671-4ba3-86e8-2cf40cf69782 |
| signalstorm.png | Signalstorm Carbine inventory art and design reference | exec-fd293d2f-7ec2-408f-b6bc-a1a55e395231 |
| lastwatch.png | Last Watch Armor, orange and cream cat animation poses | exec-28557b15-9b7b-4ea1-bd0c-d28a6626bdb7 |
| blackglass.png | Blackglass Pathfinder Armor, orange and cream cat animation poses | exec-868fc115-5228-4cf5-804e-af14d56c0622 |
| arms.png | 18 illustrated gripping-arm attachments: 3 guns × 6 outfit/fur rows | exec-086d12b8-e219-47d2-bed7-ec15eec3c9c1 |
| arms-blackglass.png | 6 matching charcoal/violet gripping-arm attachments: 3 guns × 2 fur colors | exec-7cf95184-ac9d-413e-b5ec-c1515fa2f7e1 |

The source PNGs are unchanged. `frames.json` records alpha-measured source crops. `js/ui/resistance-art.js` applies these crops at render time; it never stretches an entire sheet into an individual actor or inventory icon. Last Watch's generated sheet contains duplicate rows: the retained mapping uses one orange and one cream row, repeating one running pose to fit the game's eight-pose animation contract. Blackglass uses sixteen distinct cells. Firing/reloading uses the existing animated arm timing with the new illustrated firearm attachment.

Both armor looks retain the existing modular outfit indices and reinforcement. Rare/effect information is UI text, not baked into art. Muzzle flash uses the existing bounded effect; the Signalstorm mark is a small cyan chevron. Ward and movement readiness reuse short, small rings without covering attack telegraphs.

All seven source PNGs were decoded to verify actual alpha transparency. Some image viewers display RGB beneath transparent pixels; the Blackglass source's brown/purple hidden RGB has zero alpha between sprites. Alternate experiments were not retained in the game. `tests/resistance-art.test.cjs` verifies alpha coverage, every source crop, both cat skins, all actor pose mappings, equipment icons, and each unique equipped firearm.

The complete original prompt set is stored in `prompts.json` and its linked `attachment-prompts.json` beside these files.

The equipped firearms use finished illustrated sleeves, trigger paws and supporting paws, with no procedural ellipse-hand substitute. `arms-frames.json` records source rectangles, opaque sleeve pivots and barrel tips; `tools/measure-resistance-arms.cjs` reproduces this metadata without changing PNG pixels. Two-piece rectangles preserve near-touching muzzle tips without including a neighboring sleeve. Scout/Ranger/Vanguard and both fur colors retain their established row order; Last Watch uses matching navy/brass sleeves, and Blackglass uses its dedicated charcoal/violet sheet.

The same independent aim, recoil, reload and left-facing transforms rotate the whole attachment around its shoulder. Actual projectile and muzzle-flash origins follow the measured barrel tip. Automated checks exercise all three firearms, six existing outfit rows, both new suits/skins, eight directions, recoil, reload, dodge, opaque shoulder pivots and real emitted projectiles. A native Canvas preview of the actual game renderer was inspected at 2× size; this is not a claim of completed browser/controller testing.

