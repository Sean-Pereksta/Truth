# Static deployment and CatnMice integration

## Local launch

Extract the archive and open `index.html` with a current desktop Chromium browser. Scripts use ordinary deferred script tags, and art loads as images; there are no JavaScript module fetches or backend calls. Keep the extracted directory intact.

A browser may apply different storage or controller rules to `file:` addresses. For a consistent production environment, serve the directory over HTTPS. Any ordinary static hosting service works. A local static server is optional for development, not a game backend.

## Static hosting

Publish the contents of the extracted game folder as one directory. Its entry document is `index.html`. No build command or package installation is needed. A nested path such as `/games/meowquest/index.html` works because all bundled references are relative. Keep an existing deployment at its current address to preserve browser-local saves; the MeowQuest name does not require changing its URL.

Use standard MIME types: HTML `text/html`, JS `text/javascript`, CSS `text/css`, JSON `application/json`, PNG `image/png`, WAV `audio/wav`. If deploying an update, purge cached HTML/JS/config together so a new controller or save schema is not mixed with older code. Artwork can use long cache lifetimes when the URL is versioned.

## Cloudflare R2 / remote graphics

The separate graphics ZIP mirrors the graphics inside the `assets/` directory. Upload its contents to a public R2 bucket or CDN, preserving subfolders. For example, if `characters/bodies.png` is available at `https://cdn.example.com/whiskerfall-v1/characters/bodies.png`, set:

```js
OW.config.assetBaseURL = 'https://cdn.example.com/whiskerfall-v1';
```

The base URL points **inside the assets folder**, not at the game entry page. Do not add an additional `/assets` unless that is part of your public bucket prefix. Leave the value empty to use the bundled local graphics. Every in-game sheet, portrait, forge picture, and title illustration uses this same base.

If applying a Content Security Policy, allow image loading from the chosen CDN and allow the project's local scripts and styles. Original Web Audio synthesis does not call any external audio service. Remote graphics require a network connection; the default local configuration works offline.

## CatnMice lobby

A lobby game tile can link to the deployed `index.html`, either in a new tab or as a full-page navigation. A new tab is useful when preserving the lobby's current state. Use the title artwork as the tile image, with an appropriate crop. The game does not require a CatnMice account API, database schema, or lobby token.

If embedding in an iframe, give it enough room for the desktop game, keyboard focus, and `allow="gamepad; fullscreen"` where supported. Browser or site Permissions Policy must permit Gamepad access. A direct page link is the most portable launch method. Fullscreen begins only after a user gesture.

No existing CatnMice.com site files were supplied or modified. This package provides the static launch target; adding a tile to that site's actual source remains a hosting integration task.

## Save migration

Local saves are scoped to their browser origin. Publishing from a local file to HTTPS or changing the domain does not automatically move a campaign. Use Settings → Export before the move, then Import at the destination. Keep location IDs, catalogue order, and world seed stable for existing saves. Export a backup before major source edits.

## Optional developer checks

With Node installed, from the project folder:

```text
node tests/gameplay.test.cjs
node tests/world-content.test.cjs
node tests/input-save.test.cjs
```

Players do not need Node. Tests stub browser-specific rendering/audio where appropriate; visual and hardware checks are separate.
