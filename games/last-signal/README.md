# Last Signal

Last Signal is a first-person survival arena for 24 contestants. Play solo on Windows x64, or host a match with up to eight human players on Windows, iOS and Android. Bots fill the remaining places.

## Play on Windows

Download [Last-Signal-Windows-x64.zip](https://github.com/Sean-Pereksta/Truth/releases/download/last-signal-windows/Last-Signal-Windows-x64.zip), extract the entire folder and run **Last Signal.exe**. **Play Arena** starts a solo match.

In the Catnmice mini launcher on Windows, install **Last Signal** and choose **Host Lobby**, or start the game and choose **Multiplayer**. Sharing a room opens a Cloudflare tunnel from the host’s PC. The host copies the invite, keeps the game running and starts the round after guests ready up. Windows guests can paste the invite into **Multiplayer → Join with an invite**.

## Join in a browser

Open [Last Signal in your browser](https://sean-pereksta.github.io/Truth/games/last-signal/), choose a public arena or paste the host’s full HTTPS invite. You can also open the invite directly. Enter a name and select **Ready** in the room lobby. Browser and Windows players share the same match and eight-player limit. Hosting and solo play run on the Windows game.

**Keyboard and mouse:** Click the arena to capture the mouse. Move with WASD, attack with left click, guard with right click, and interact with E. I, C and B open the pack, crafting and building. Escape releases the mouse.

**Touch:** Use the left thumb area to move and drag the right side to look. Attack and interaction stay within reach, with pack, crafting and building in the action menu.

## Arena equipment

Swords and round shields are available at the Cornucopia and in the crafting menu. Carry a shield with a spear or sword and hold right click (Guard) to raise it. Attacks that pass beside, above or below the shield can still hit you.

One in three rounds rolls a crossbow at a field supply site away from the Cornucopia. It comes with four bolts. Equip it to start loading. A bolt flies farther than a bow shot, and the next shot takes four seconds to reload. Switching weapons interrupts an unfinished reload.

## Build from source

On Windows, run `.\Build-Windows.ps1` from this folder. The script unpacks the original assets and hosting components into `build/windows`, includes the browser client and compiles the checked-in C# using the .NET Framework 4.x x64 compiler.
