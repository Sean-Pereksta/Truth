# Game art

All five game-art assets were generated with the built-in ImageGen tool and are stored in this project. The game loads these local PNGs; it has no external art-service dependency.

## Faction title artwork

- `dist/assets/pac-banner.png`: portrait key art with Pac-Man, miners, and a Guardian over the mossy maze.
- `dist/assets/ghost-banner.png`: portrait key art with a red commander, Wisp, Binder, Brute, and the central Ghost Citadel.
- The setup strip switches imagery, accent colors, faction name, and tagline when a faction is selected.
- Original generation prompts are included in `FACTION_ART_PROMPTS.txt`.
- The standalone game decodes embedded images into local Blob URLs. Short shared image URLs keep CSS portraits and icons visible without exceeding browser custom-property limits. No art is downloaded at runtime.

## Animated units

- File: `dist/assets/units.png`
- Source dimensions: 1254 × 1254 pixels, RGBA PNG.
- Layout: eight columns of animation frames and eight character rows.
- Rows, top to bottom: Pac-Man; mining minion; armored Guardian; Engineer; red Hunter ghost; cyan Wisp scout; pink Binder ghost; purple armored Brute ghost.
- The Extractor shares the Engineer animation, with a distinct equipment base drawn by the renderer.

Prompt specification summary: a production sprite sheet for a top-down Pac-Man-inspired asymmetric RTS, cohesive detailed pixel art, transparent background, a precisely aligned 8 × 8 grid, eight right-facing movement frames for each character, readable silhouettes, yellow Pac units and varied ghost troops, without labels or grid lines. This is a summary of the generation brief rather than a verbatim prompt transcript.

The renderer reads each frame from the PNG, computes a shared transparent crop per character row, and normalizes the frames into a temporary 512 × 512 atlas. This preserves each character's animation alignment and ground baseline while keeping the characters readable at battlefield scale. The original PNG is retained unchanged. Very low-alpha colored pixels in the source background are effectively transparent and do not represent a solid colored background.

## Textured terrain

- File: `dist/assets/terrain.png`
- Source dimensions: 1254 × 1254 pixels, RGB/RGBA PNG.
- Layout: four square texture quadrants, each 627 × 627 pixels.
- Top left: dark slate stone floor.
- Top right: mossy stone floor.
- Bottom left: blue-gray brick wall.
- Bottom right: dark violet brick wall.

Prompt specification summary: a coherent 2 × 2 terrain texture atlas for the same dark arcade fantasy RTS, overhead seamless stone materials, slate paving and mossed paving above, blue-gray and violet masonry below, detailed pixel-textured surfaces, no units, symbols, lettering, borders, interface, or props. This is a summary of the generation brief rather than a verbatim prompt transcript.

The renderer samples the four quadrants into continuous repeating textures, adds wall bevels and depth shading, and caches the finished maze. Fog, pellet sensors, unit selection, construction previews, and combat effects are drawn over that cached terrain.

## Buildings and building icons

- File: `dist/assets/buildings.png`
- Source dimensions: 1774 × 887 pixels, RGBA PNG.
- Layout: four columns and two rows, eight static building sprites in row-major order.
- Top row: Command Nest, Refuge, Pulse Tower, Digestor.
- Bottom row: Haunt Lair, Watch Relay, Spectral Spire, construction site.

Prompt specification summary: a transparent 4 × 2 building sprite atlas matching the game's detailed pixel-art units and terrain, slight top-down three-quarter perspective, individual centered structures with clear spacing and no labels or interface. Pac structures use gold stone and machinery with turquoise energy; ghost structures use violet masonry with red, cyan, or pink supernatural details. Include the Pac headquarters, forward refuge, defensive pulse tower, energy Digestor, ghost fortress, eye-shaped observation tower, crystal defense spire, and a scaffolding-and-crane construction site. This is a summary of the generation brief rather than a verbatim prompt transcript.

The battlefield renderer alpha-crops each static building independently into a temporary 1024 × 512 atlas. Sprite bottoms share a consistent ground baseline. Buildings cast footprint shadows and retain separate selection, health, construction, and training overlays. Unfinished buildings display the construction-site sprite over a faint silhouette of their planned structure. Once this asset loads, real sprite art replaces the temporary procedural building fallback.

The command interface uses the same original 4 × 2 atlas for building buttons and selected-building portraits, so its icons match structures on the battlefield. `BUILDING_SPRITES` in `dist/render.js` records the shared frame indices.
