# Last Signal

Last Signal is a first-person survival arena for Windows x64. A match begins with 24 contestants and ends with one survivor. Play solo with 23 AI contestants, or host up to eight human contestants with bots filling the remaining places.

## Play on Windows

Download [Last-Signal-Windows-x64.zip](https://raw.githubusercontent.com/Sean-Pereksta/Truth/main/games/last-signal/Last-Signal-Windows-x64.zip), extract the entire folder and run **Last Signal.exe**. **Play Arena** starts a solo match.

From the Catnmice Windows launcher, install **Last Signal** and select **Play**. Open **Multiplayer** to host a room or join a friend's game. The host shares the invite shown in the lobby and keeps the local game running throughout the match. Each guest uses the Windows game client. Internet hosting uses the included Cloudflare tunnel.

## Build from source

On Windows, run `.\Build-Windows.ps1` from this folder. The script unpacks the runtime assets and hosting components into `build/windows` and compiles the checked-in C# using the .NET Framework 4.x x64 compiler. The portable archive also contains the same source and original art generation scripts.
