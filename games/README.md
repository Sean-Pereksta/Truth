# Browser games

Current playable editions imported from the supplied desktop game folders. Each game is self-contained in its own directory and can be served by GitHub Pages without a backend.

| Game | Play | Local entry |
| --- | --- | --- |
| Bannerlands · The War of Crowns | [Play](https://sean-pereksta.github.io/Truth/games/bannerlands/) | `bannerlands/index.html` |
| Monster Mall — Expanded Edition | [Play](https://sean-pereksta.github.io/Truth/games/monster-mall-expanded/) | `monster-mall-expanded/index.html` |
| Pac-Man: Blackout | [Play](https://sean-pereksta.github.io/Truth/games/pacman/) | `pacman/index.html` |
| Pirates — Crown of the Tides | [Play](https://sean-pereksta.github.io/Truth/games/pirates/) | `pirates/index.html` |
| Academy Standards · The Banner Trial | [Play](https://sean-pereksta.github.io/Truth/games/academy-standards/) | `academy-standards/index.html` |
| Operation Whiskerfall · MeowQuest | [Play](https://sean-pereksta.github.io/Truth/games/operation-whiskerfall/) | `operation-whiskerfall/index.html` |

The Catnmice lobby in `Sean-Pereksta/Magic`, at `lobby/lobby.html`, links to these public pages. Local two-player options are managed within the games; these imports do not use Catnmice online hosted lobbies.

Keep each game's relative folder structure intact when updating it. The current JavaScript, styles, artwork and credits are included with each game. Historical backups and temporary preview/test outputs are omitted. The repository's existing budget tracker and chat pages remain at their original addresses.

Use a local static web server for development, especially for the games that use JavaScript modules. The `.nojekyll` file in the repository root makes GitHub Pages serve the game files directly.
