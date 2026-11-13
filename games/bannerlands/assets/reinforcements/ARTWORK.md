# House reinforcement artwork

Generated with the built-in image generation tool for this update.
All six troop sheets have four columns and two rows: walk 0–3, attack 4–7.
Every troop has its own PNG; the renderer never substitutes a common sprite.

| Sheet | House |
| --- | --- |
| stormbreaker.png | Baratheon |
| saltwind_axethrower.png | Greyjoy |
| tollhouse_crossbow.png | Frey |
| crannog_spearhand.png | Reed |
| hornhill_halberdier.png | Tarly |
| sun_horse_archer.png | Martell |

`buildings.png` is a three-column, two-row transparent atlas. Cell order:
Stormbreaker Forge, Saltwind Lodge, Tollhouse Range, Crannog Spear Lodge,
Horn Hill Drill Hall, Sunbow Corral. Building art includes native house colors.

The exact troop and building prompts are in `prompts.json`. The building
refinement removes the background and adds transparent cell margins.
Renderer checks verify 48 distinct animation cells, alpha transparency,
six matching buildings and exact house selection. The standalone builder
embeds every sheet and building directly in its HTML output.
