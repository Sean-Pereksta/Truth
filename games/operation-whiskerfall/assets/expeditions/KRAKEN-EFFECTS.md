# Nacremaw attack artwork

`kraken-effects.png` is original artwork generated with the built-in OpenAI image generation tool for this game on 29 October 2026. The transparent source is preserved byte-for-byte. No external game art was used.

The first generation was revised with the image tool to isolate all eight effects with transparent gutters. The shipped source is the revised image (`exec-042bbffa-4aea-4c10-8d0c-d37e3353ce35.png`). Pixel measurements produce `kraken-effects.frames.json`; no pixel editing or background removal was performed after generation.

The original prompt requested a four-column, two-row painted fantasy action-RPG VFX sheet: a horizontal violet tentacle with turquoise suction cups; a raised tentacle; radial tidal splash; foaming wave crest; glowing ink projectile; ink whirlpool; water spray; and shattered pearl shells. The revision preserved the effects and increased transparent spacing. No labels, interface, background, or warning geometry were requested.

`js/ui/kraken-effects.js` animates the measured source frames during actual attack states. Tentacles are clipped to strike lanes, expanding wave crests are clipped to their live radial band and safe escape gap, and the ink projectile's glowing head follows its collision point. Existing warnings remain in the renderer. Sea Beast Armor uses the tentacle and whirlpool artwork for its two effects. Rendering adds no damage, gameplay timers, projectiles, or saved fields. Missing images fall back to the previous visible warning/projectile renderer.

The shell-shard frame is retained as an original supplementary effect and is not currently emitted in combat. Source provenance for the separate creature, equipment and ability artwork is documented in `PROVENANCE.md`.
