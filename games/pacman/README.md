# Pac-Man: Blackout

Lead a Pac team alongside two AI partners, or command the Ghost Legion, in a real-time strategy game with fog of war, base building, and four difficulties.

The playable web entry is `index.html`. The current editable JavaScript, CSS, and artwork are beside it. Serve this folder over HTTP; opening the split-module entry directly with `file://` is unsupported.

- Local preview: `npm start` (http://127.0.0.1:4173).
- Gameplay regression checks: `npm test`.
- Build a standalone offline copy: `node source/tools/build-offline.cjs --output=<output-file.html>`.

Choose a faction, then ENTER THE MAZE. The in-game help explains controls and objectives. START NEW MATCH in the command menu restarts play.

- Control groups: select your troops or structures and press Ctrl+1–9 (Command+1–9 on Mac) to assign. Shift+1–9 adds the current selection. Press 1–9 to recall; press twice quickly to focus the camera. Clickable group boxes show surviving members. Groups reset for a new match.
- Production: T opens Summon and B opens Build. Z, C, V, N, G activate the labeled option in the current tab; number keys always belong to control groups. E remains Power and Q remains the Ghost Binder snare. Building labels display construction shortcuts and roles on the battlefield.
- Pac structures: Command Nest is a durable recruitment hub; Refuge provides forward recruitment and 9-tile vision; Pulse Tower defends; Digestor produces Spark and Power; Sanctuary heals. The Sanctuary costs 95 Spark and heals Pac-Man and allied troops for 10 HP/sec within 6 tiles after 4 seconds without damage. Healing requires a completed living structure and line of sight. Overlapping healing does not stack. Allied AI builds Sanctuaries and brings injured forces to them.
- Exterior cover: every map has 16–19 ruin courts outside the main maze. Their walls block vision and projectiles; two broad exits support escape. Starting yards and maze gates stay clear. These pockets provide cover, not invisibility: enemies can scout inside.

Source and artwork were imported from the supplied Pacman folder. Duplicate standalone builds and local workflow files are excluded.
