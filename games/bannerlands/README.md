# Bannerlands · The War of Crowns

Command armies, conquer the grid, and unite the realm in an isometric real-time strategy game.

The playable web entry is `index.html`. The current editable JavaScript, CSS, and artwork are beside it. Serve this folder over HTTP; opening the split-module entry directly with `file://` is unsupported.

- Local preview: `npm start` (http://127.0.0.1:4173).
- Syntax checks: `npm run check`.
- Gameplay regression checks: `npm test`.
- Build a standalone offline copy: `node source/build-standalone.mjs <output-directory>`.

Controls, house details, and the current update guide are in `docs/`. Current game files were imported from the supplied Bannerlands folder; historical `Original/` backups and preview images are excluded. Gameplay code and artwork are unchanged. Supporting tools only use paths adapted to this web folder layout.
