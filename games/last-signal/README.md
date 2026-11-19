# Last Signal

Last Signal is a first-person survival arena for 24 contestants. Play solo on Windows x64, or host a match with up to eight human players on Windows, iOS and Android. Bots fill the remaining places.

## Play on Windows

Download [Last-Signal-Windows-x64.zip](https://github.com/Sean-Pereksta/Truth/releases/download/last-signal-windows/Last-Signal-Windows-x64.zip), extract the entire folder and run **Last Signal.exe**. **Play Arena** starts a solo match.

In the Catnmice mini launcher on Windows, install **Last Signal** and choose **Host Lobby**, or start the game and choose **Multiplayer**. Sharing a room opens a Cloudflare tunnel from the host’s PC. The host copies the invite, keeps the game running and starts the round after guests ready up. Windows guests can paste the invite into **Multiplayer → Join with an invite**.

## Join from a phone

Open the host’s HTTPS invite in Safari or Chrome, enter a name and tap **Ready** from the lobby. Use the left thumb area to move and drag the right side to look. The touch HUD keeps attack and interaction within reach, with pack, crafting and building available from the action menu. Phone players share the same match and eight-player limit as Windows players. Hosting and solo play run on the Windows game.

## Build from source

On Windows, run `.\Build-Windows.ps1` from this folder. The script unpacks the original assets and hosting components into `build/windows`, includes the browser client and compiles the checked-in C# using the .NET Framework 4.x x64 compiler.
