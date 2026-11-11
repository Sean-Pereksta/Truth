# Pac-Man: Blackout

Lead a Pac team alongside two AI partners, or command the Ghost Legion, in a real-time strategy game with fog of war, base building, and four difficulties.

The playable web entry is `index.html`. The current editable JavaScript, CSS, and artwork are beside it. Serve this folder over HTTP; opening the split-module entry directly with `file://` is unsupported.

- Local preview: `npm start` (http://127.0.0.1:4173).
- Gameplay regression checks: `npm test`.
- Build a standalone offline copy: `node source/tools/build-offline.cjs --output=<output-file.html>`.

Choose a faction, then ENTER THE MAZE. The in-game help explains controls and objectives. START NEW MATCH in the command menu restarts play. Current source and artwork were imported from the supplied Pacman folder. Duplicate standalone builds and local workflow files are excluded. Gameplay code and artwork are unchanged. Supporting tools only use paths adapted to this web folder layout.
