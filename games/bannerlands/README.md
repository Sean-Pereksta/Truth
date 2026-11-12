# Bannerlands · The War of Crowns

Command armies, conquer the grid, and unite the realm in an isometric real-time strategy game.

The Lands Update adds Crownlands, Riverlands, Highland Marches, Shattered Coast,
and Kingsroad, alongside the original Open Realm. Rivers, five-lane bridges,
mountain passes, shallow fords, and roads change both army routes and lord strategy.
Choose a landscape in the campaign menu; the preview shows its actual geography.
See `docs/Lands-Update.txt` for movement rules and map details.

The playable web entry is `index.html`. The current editable JavaScript, CSS, and artwork are beside it. Serve this folder over HTTP; opening the split-module entry directly with `file://` is unsupported.

- Local preview: `npm start` (http://127.0.0.1:4173).
- Syntax checks: `npm run check`.
- Gameplay regression checks: `npm test`.
- Build a standalone offline copy: `node source/build-standalone.mjs <output-directory>`.

Controls, house details, and update guides are in `docs/`. The game was originally imported from the supplied Bannerlands folder; historical `Original/` backups and preview images are excluded. The source and artwork beside the web entry are the maintained version.
