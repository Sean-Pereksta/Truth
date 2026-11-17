# Full-game multiplayer preview

This is a reviewable implementation of the maintained Bannerlands game with
Windows player hosting, browser guests, and the existing Firebase project.
It replaces the prototype's tactical map with the original `app.js` controls,
`render.js` painted battlefield, all house artwork, heroes, standards, and game
simulation. The preview supports **one to four human players**, with bots in
the other participating houses and up to sixteen total houses where the mode
allows them.

**Release acceptance remains open.** A completed match between separate physical
locations, sustained large-battle smoothness, lower-powered physical devices,
and broad-release connection suitability must be verified before calling this
the finished public multiplayer update. Passing local integration checks does
not substitute for those tests. See the measured evidence and limits below.

## Player instructions

Download `Bannerlands-Setup.exe` from the versioned preview release, run it,
and launch the new Bannerlands desktop icon or Start menu entry. The installer
includes Node and cloudflared; players do not install development tools, open a
terminal, obtain a Cloudflare account, or configure router forwarding. This
preview installer is unsigned. Compare its SHA-256 with the release checksum.

Choose your house and campaign settings in the existing menu. Select **Host
Lobby**, choose the participating houses, human seat count, lobby name, display
name, and public/private visibility. All configured human seats must be occupied
before starting. The other houses are AI opponents using the chosen difficulty.
To play with fewer humans, change the human seat count before everyone confirms
readiness. A settings or house change resets readiness.

Hosting starts the local match service and a temporary Cloudflare connection,
checks the public match identity, then enables invitations and discovery. Copy
the **guest** invitation from the lobby. Host controls and existing player
sessions never appear in that invitation or the public directory.

Guests visit the website and choose **Browse Lobbies** or **Join by Invite**.
They load the complete artwork, select an available house, and mark ready. They
need no installed hosting software. The host starts the battle after all players
are connected and ready. Only the assigned house's soldiers and buildings can be
commanded. The original buttons, keyboard shortcuts, formation placement,
contextual commands and touch paths use the same authoritative command layer.

Website browsing and Join by Invite keep the website page and its artwork cache
in place while connecting to the selected remote host. Reloading remembers that
host and recovers its private session. Switching to another lobby leaves the
prior session and stops an owned hosting connection. Direct guest invitation
links still open the temporary host page; their cache belongs to that temporary
address, so a newly generated direct-link address may download the artwork again.

Guests can reload the same browser tab to recover their private session and
house. A temporary disconnect leaves the battle running; human houses receive
no ordinary AI takeover. An abandoned pre-match reservation expires after
90 seconds. A running match keeps that player's seat for reconnection. Closing
the tab may lose its tab-private session; a new guest cannot take over that house
or create a duplicate commander after the battle starts.

The host must remain awake, online and running Bannerlands. If that laptop
closes, sleeps or loses its connection, guests cannot continue an independent
battle. There is no host migration. The host can end a match and return everyone
to the lobby, or stop hosting. Menus do not pause an online battle; simulation
speed remains fixed. Single-player remains usable when online services fail.

## Architecture and compatibility

`source/multiplayer-server.mjs` runs the original `Game` on the host at fixed
1/30-second simulation steps. Clients send ordered commands and render filtered
host snapshots. They do not run seeded parallel simulations. AI updates skip
all human-controlled houses. Victory rules consider the complete surviving
campaign rather than ending when team zero falls.

The preview requires an exact match of protocol major, game version and artwork
version. `multiplayer/protocol.js` defines them. Admission checks compatibility
before assigning a seat. After every player marks ready, the host creates the
world and holds simulation time at zero until each browser acknowledges its
initial synchronization. A 45-second deadline returns everyone to the lobby
with an actionable message if a player cannot finish. Each match also has its
own identity: a delayed command
from a previous match cannot affect a restarted campaign. Any incompatible
change requires a version bump before distribution; do not replace a published
release's assets with different bytes under the same version.

Commands contain an increasing sequence, action, arguments and match identity.
The host validates entity ownership, targets and sight, finite coordinates,
allowed actions/formations/buildings/units, costs and legal gameplay through the
existing simulation. Duplicate replies do not execute a purchase twice.
Malformed/oversized bodies, request frequency, header/read deadlines and
authentication are bounded. Seats are reserved synchronously in one process,
so concurrent final-seat requests cannot share a house.

Initial synchronization includes public static terrain and only the allowed
dynamic view. Subsequent updates use entity/property deltas with an exact
baseline, stable entity/effect identifiers, run-length territory/fog grids and
gzip. Missing baselines trigger complete synchronization. Battlefield traffic
goes through the game connection, never Firebase.

Snapshots use explicit field allowlists. With fog enabled, hidden enemy units,
current hidden building state, economy, orders, targets and AI plans are not
sent. Allied sight and observed building memory are preserved. Existing public
victory scores remain public; unseen objective-ring state does not. Both guests
and fog-limited AI use knowledge permitted by the original rules.

Client interpolation uses bounded history, adjusts to update spacing, keeps
presentation time moving forward, and never extrapolates beyond the latest
authoritative position. Rendering temporarily interpolates positions and
formation anchors and then restores authoritative query data. Camera input is
independent of network updates. Dashed order markers provide immediate pending
feedback; acceptance/rejection comes separately from the host. Artwork requests
are bounded and retried, and compatible PNGs are cached by version.

The player-controlled host is trusted. These checks prevent guests issuing
unauthorized commands; they do not make the host impossible to modify or cheat.

## Firebase and connection service

The project remains `bible-game-246c0`. The new Firestore collection is
`bannerlandsCampaignLobbies`; the earlier prototype's collection and unrelated
game rules are preserved. Current deployed rules were fetched and extended,
tested in the emulator, deployed and read back byte-for-byte. The implementation
publishes token-free metadata only after reachability, removes unavailable
lobbies and expires crashed listings from browsing. Queries and heartbeats are
bounded to 30-second intervals, with 90-second expiry and a 50-record query
limit. Public browsing does not create anonymous authentication accounts.

See [Firebase-Multiplayer.md](Firebase-Multiplayer.md) for the deployed ruleset,
preservation hashes, live write/read/delete evidence and measured usage.

The temporary connection is a testing arrangement. Cloudflare documents random
addresses, no availability guarantee, a 200 in-flight request limit and no SSE
support for Quick Tunnels. HTTP polling fits that restriction. See the
[official Quick Tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
Before broad public release, evaluate a managed/named tunnel or another
supported connection service, including account, domain, terms and actual
traffic costs. No permanent address, unlimited free service or SLA is promised.

## Builds, installation and updates

The Windows x64 installer and portable ZIP include the full game, verified
Node v24.19.0 and cloudflared 2026.11.0 binaries, licenses and dependency notices.
The installer creates desktop and Start menu shortcuts with the game crest.
Files install beneath LocalAppData/Programs/Bannerlands; logs and temporary
hosting data use LocalAppData/Bannerlands. The uninstaller checks its product
marker and removes its own files and shortcuts. Personal browser storage is
retained. Launcher shutdown stops only the connection process it created.

Each package has a versioned manifest and SHA-256 for every bundled file, plus
checksums for the installer and ZIP. Installation verifies the manifest before
copying. Updates are manual: stop the running game, obtain the exact versioned
release, verify its checksum and install it. Automatic self-update is not
implemented. The original self-contained single-player HTML builder and offline
browser check remain supported separately from multiplayer hosting.

Developer scripts: `npm test`, `npm run check`, `npm run test:multiplayer`,
`npm run test:multiplayer-browser`, and `npm run benchmark:multiplayer`.
`source/build-host.mjs` documents the pinned runtime inputs in its command-line
arguments; `source/hosting/README.md` describes reproducible packaging and
connection limits. Players use the installer, not these developer commands.

## Validation and remaining acceptance

The reference machine is Windows 11 x64, AMD Ryzen 7 5825U, 16 logical processors,
about 13.84 GiB usable RAM, Node v24.19.0 and Chrome 157.0.8103.52. Automated
Chrome contexts on one laptop verify the real maintained renderer, assigned
house selection, recruitment, commands, readiness and reload recovery. Four
human sessions with twelve AI houses have been exercised; this establishes a
functional four-human limit, not a universal 60 FPS performance claim.

The evidence directory contains exact map sizes, houses, seeds, army counts,
simulation/serialization/compression timings, frame intervals, bandwidth,
memory and test methods. Full-capacity campaigns retain the original 280 troops
per initial castle (up to 4,480 troops across sixteen starting houses).
Collision candidate bins preserve exact fixed-seed outcomes and original
iteration order; projection caching, presentation precision and property-delta
encoding change network work rather than combat rules or graphics.

### Four-player preview soak

On November 17, 2026, four Chrome players joined a private standard Crownlands
campaign on the reference laptop with twelve AI houses, fog and seed 44277.
The guest issued Hold, recruited infantry and recovered the same house after
reloading. All four players retained control of their assigned troops. The
180-second post-reload sample recorded zero browser errors, guest polling
failures or resynchronizations.

| Measure | Result |
| --- | --- |
| Guest frame interval, p95 / p99 | 133.4 / 200.0 ms |
| Guest frames over 100 ms | 448 of 1,931 |
| Host simulation progress | 51.8 game seconds in 184.69 wall seconds (0.28×) |
| Visible pending feedback for Hold | 9.6 ms |
| Host acknowledgment for Hold / recruit | 511.3 / 644.4 ms |

The wall-time measurement includes the final ownership checks. Sampled
JavaScript heap sizes (first / peak / last) were 161 / 268 / 191 MiB on the host
and 17 / 32 / 28 MiB for the guest. Native and graphics memory were outside the
measurement. The normal starting armies on this shared machine missed the
sustained real-time target. Full-capacity army timings, lower-powered hardware
and independent physical networks have separate acceptance checks.
[Recorded soak results](multiplayer-evidence/battlefield-preview-soak.json)

### Battlefield preview packaging and production handoff

On Windows, `npm run build:release -- --output <folder> --cloudflared <exe>`
builds the website ZIP, offline HTML, Windows installer and portable ZIP from
the same checkout. Use the Node runtime and cloudflared binary pinned in
`source/hosting/licenses/components.json`. Unpack the website ZIP beside the
other three files. Its download page checks the game, art and protocol versions
in `release-manifest.json` before showing the local downloads. The outer
manifest and `SHA256SUMS.txt` also cover the website ZIP. The review build uses
the checked-in crest for both Windows launch paths.

The current temporary connection is suitable for preview testing. A production
pilot needs a publisher-operated relay or managed tunnel, a scoped credential
per host, and a stable public address for each active match. The publisher
must choose an operator and validate provisioning, revocation, traffic cost,
availability and outage behavior before enabling public discovery. Exercise a
complete match, an interrupted guest connection and a host shutdown from two
independent physical networks, using the signed candidate and the deployed web
build. [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)

For Windows distribution, provision the verified publisher identity and signing
service, sign the final setup executable using SHA-256 and an RFC 3161
timestamp, and verify the signature and publisher on a clean Windows machine
with `signtool verify /pa /v Bannerlands-Setup.exe`. Recalculate the release
checksums and both manifests from the signed bytes before publication. The
current preview packager emits unsigned files. Signing and the independent
network test require the release operator's infrastructure.
[Microsoft SignTool](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool)

### Acceptance checks

- Complete a real match between separate physical locations over independently
  connected devices. A same-laptop trip through a public tunnel is useful
  connection validation but is not that acceptance test.
- Meet the agreed sustained frame/command-response targets for large armies,
  large maps, AI activity and hosting/rendering together. Existing large-battle
  measurements exceed the simulation/frame budget; retain the army capacity
  and fix computation/network costs before advertising broad smoothness.
- Measure actual lower-powered hardware, long campaign memory growth and
  unstable real networks. CPU throttling and short synthetic runs must not be
  presented as physical-device or long-soak evidence.
- Test other advertised host/browser/platform combinations before expanding
  beyond the verified Windows/Chrome baseline.
- Validate the public download/release path, code-signing and production
  connection/service usage before general release.

Authoritative save/resume is investigated but unavailable. Guest snapshots are
deliberately incomplete and cannot be used as saves. A correct host save needs
all simulation state, RNG, AI commitments, pending combat/reloads, objectives,
timers, capture work, hero/standard state, and command/session rebinding, with
derived spatial/navigation caches reconstructed and uninterrupted/resumed
campaign parity proven. Host migration remains a separate capability.
