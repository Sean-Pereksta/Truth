# Painted bridge sides

Generated with the built-in image generation tool; exact prompt in `prompts.json`.
`stone-edges.png` is a two-column, two-row transparent PNG atlas:

1. Continuous dressed-stone masonry and coping, front elevation.
2. Matching two-tile arch span, with a genuinely transparent opening.
3. Tall terminal pier.
4. Short corner post.

The engine projects front-elevation masonry along both isometric bridge axes.
Run phase is global, so arch spans and posts join across cached tile chunks.
Rear geometry draws behind the textured deck; the left/front rail overlaps its
start post and deck; the near terminal post is the final foreground piece.
Only exposed sides receive walls; all five walking lanes remain unchanged.
Low-alpha generation fringe is discarded on import. The source PNG remains
unchanged. Runtime graphics use bounded static caches, not per-frame geometry.
