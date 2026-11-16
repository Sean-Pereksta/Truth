# Bannerlands player hosting

The installed Windows application opens the maintained Bannerlands game in the
default browser. Its bundled Node process serves the complete game and owns the
authoritative simulation. A managed `cloudflared` child exposes only that HTTP
game service. The local service binds `127.0.0.1`, never all network adapters.

The player needs no terminal, Node installation, router configuration, Cloudflare
account, or hosting credentials. Website guests keep that website's renderer and
versioned artwork cache while connecting to the selected host API. Direct guest
invitations load the same maintained game from the temporary game address;
changing that address requires a separate browser-origin cache. Single-player
works when the internet or lobby directory is unavailable.

Only the downloaded application can create and host lobbies. The website/browser
edition can browse and join lobbies without installing the game; its guests do
not receive the private desktop capability required to start hosting.

## Sessions and interruptions

- A local desktop capability, a host-control token, guest invitation, and each
  private player session are separate capabilities. Only the guest invitation
  belongs in a share link. Local bootstrap fragments are stripped from the URL.
- The host process reserves seats synchronously. Two requests for the final seat
  cannot receive the same house. Waiting reservations expire after 90 seconds
  without a heartbeat; an active match retains each house for reconnection.
- Every configured human slot must be occupied and ready. Up to four humans may
  share campaigns of up to sixteen houses; remaining houses run ordinary AI.
  Humans are never automatically handed to AI during disconnection.
- Starting creates a read-only initial world while simulation stays at time
  zero. Every human confirms a delivered, hydrated snapshot and loaded artwork
  before the server starts the battle. A 45-second synchronization deadline
  returns everyone to the lobby with an actionable error and fresh readiness.
- Battles continue during guest interruption. The same browser's private
  session recovers its house and last consumed command sequence. Guests should
  not erase browser session storage during a match.
- Every battle has a fresh `matchId`. Commands from an earlier battle are denied
  before sequence checking, even when seed, house and entity IDs are repeated.
- Ending a match returns the existing players to the lobby. Closing installed
  hosting stops its own tunnel, removes discovery, revokes guest sessions,
  rotates the invitation and leaves the local single-player service usable.
- Closing the browser lets the local process expire after a three-minute idle
  grace period. A separate private desktop heartbeat keeps single-player alive;
  guest traffic cannot extend a closed host browser's lease. Explicit Stop
  Hosting closes the connection immediately. No
  host migration or authoritative save/resume is implemented. Host loss ends the
  match, and the hosting laptop must stay awake and online.

## HTTP boundary

The browser polls versioned, house-filtered world snapshots at a bounded rate.
Initial synchronization includes static terrain. Later updates send changed
entity fields and removals, with a baseline sequence. Each player retains at most
four recent filtered snapshots so one lost response can catch up through a
delta. Missing older baselines request full synchronization, and histories clear
on a match or house change. Responses support gzip and ETags. No hidden complete world
is sent to guests when fog is enabled.

The service exposes root game HTML/CSS/JavaScript, multiplayer client modules,
and artwork. `source/`, tests, package files, notices and runtime executables are
not public HTTP resources. Requests have 32 KiB JSON limits, finite command
validation, 10-second upload/header deadlines and rate limits. Arbitrary invalid
Bearer strings share an address bucket and cannot create unbounded rate keys.
Known sessions have independent buckets because a tunnel shares a loopback peer.

`GET /api/lobby` contains discovery and campaign settings only. Private tokens
are accepted in Authorization headers. Only host authorization may configure,
start, end or close a match or inspect metrics. Full version compatibility is
required before reserving a guest seat. Readiness is bound to a campaign revision.

`GET /api/metrics` reports simulation work, commands, response sizes, encoding and
compression time. Directory adapter usage counts actual auth requests, writes,
deletes and transfer estimates separately from attempted directory operations.
Battlefield traffic never goes through Firebase.

## Temporary connection suitability

[Cloudflare's Quick Tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
was checked on 2026-11-16. It describes Quick Tunnels as testing/development
connections, with no uptime guarantee, changing hostnames, a 200 in-flight
request ceiling and no SSE support. This implementation uses ordinary HTTP
polling. Startup has a 90-second overall deadline, including up to 75 seconds
for public-address activation and reachability, with clear DNS progress and
recovery messages. A discovered address is tested against the correct lobby ID
before discovery is published.

This preview does not promise permanent URLs, guaranteed availability or
unlimited free service. Broad public release requires a separate production
connection assessment, provider account/domain arrangements where applicable,
and a current cost estimate. Those operational arrangements are not supplied
by this preview installer. The host is a trusted authority and can modify its
simulation; player hosting does not prevent host cheating.

### Production alternative and current costs

As checked on 2026-11-16, a [named public Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/)
requires a Cloudflare account, a domain on Cloudflare, public hostname/DNS routing
and the host's outbound internet connection. Stable routing still depends on
the laptop and does not preserve a match after its authoritative host disappears.

A possible accountless player experience is an operator-managed provisioning
service: the operator owns the account/domain and issues a separate scoped
tunnel capability per hosting session. Global account and DNS API credentials
must remain in that service. This is an architectural proposal inferred from
the documented APIs, not implemented by this preview; it needs authenticated
admission, quotas, lifecycle cleanup and operational monitoring.

[Tunnels for Platforms](https://developers.cloudflare.com/tunnel/features/tunnels-for-platforms/)
currently includes 1,000 tunnels per account at no tunnel-capacity charge and
lists additional capacity at **US $4.50 per tunnel per month**. Existing inactive
tunnels count, so 1,200 retained tunnels would imply $900/month in additional
tunnel capacity. This is not an estimate of the complete service bill: domain
registration/renewal, the provisioning service, optional services and applicable
provider terms still need evaluation. No domain was selected, so no invented
registration price is included.

The [Zero Trust pricing page](https://www.cloudflare.com/plans/zero-trust-services/)
links to [Access pricing](https://www.cloudflare.com/sase/products/access/), which
currently lists a $0 plan for teams under 50 users and $7/user/month paid
annually for its pay-as-you-go access-control plan. That is separate product
pricing; this game does not assume every public guest needs a paid Access seat.
Any support/SLA commitment must be checked against the purchased service and
contract. These current prices do not grant a production availability guarantee.

## Rebuilding the Windows installer

Run on Windows with development tools available to the maintainer. Players need
none of them. The builder uses Windows' bundled .NET Framework C# compiler to
produce a graphical installer with an embedded, verified payload. It creates
desktop/Start menu shortcuts and an Add/Remove Programs entry without admin
installation. Its portable ZIP includes a hidden launcher.

The running installation writes a private process/session marker in the user's
LocalAppData Bannerlands directory. The uninstaller verifies the exact product
root and executable, then asks that service to shut down with its private local
capability. It waits for orderly cleanup and never kills processes by name.
Updates use the same mechanism before replacing locked runtime files.

```powershell
node source/build-host.mjs `
  --output C:\path\to\build-output `
  --cloudflared C:\path\to\cloudflared.exe `
  --cloudflared-licenses source/hosting/licenses/cloudflared-dependencies `
  --source-commit <reviewed-commit-sha>
```

The Node runtime defaults to the running builder executable, or use `--node`.
Both executables must match `licenses/components.json`, checked before they are
executed or copied. The current pinned components are Node v24.19.0 and
cloudflared 2026.11.0 Windows x64; their SHA-256 values were verified against the
official Node SHASUMS and Cloudflare release asset digest. Runtime and dependency
licenses are bundled. Cloudflared dependency notices were collected from tag
2026.11.0 with `github.com/google/go-licenses/v2` v2.0.1; the source module
licenses cover its associated assembly files as well.

The build creates `Bannerlands-Setup.exe`, `Bannerlands-Windows-x64.zip` and
SHA-256 sidecars, plus an installation manifest hashing every payload file.
Verify the release downloads, close Bannerlands and reinstall the newer exact
version. Personal settings and browser data and LocalAppData hosting logs live
outside installed files and are preserved on uninstall. Automatic updating and
code signing are not included in this preview.

Initial test targets are Windows 11 x64 and current Chrome/Edge. Performance and
separate-location acceptance require the accompanying measured test report;
the installer alone is not evidence for a universal 60 FPS or release readiness.

## Checks

```text
node source/tests/multiplayer-server.mjs
node source/tests/hosting-tunnel.mjs
node source/tests/hosting-activity.mjs
```

`hosting-live.mjs` is an opt-in live test: it starts the actual launcher and
cloudflared binary, temporarily publishes one Firebase listing, checks public
assets and credentials, and cleans up. It is not part of the default tests and
must be explicitly authorized before exposing a local test service publicly.
Even a successful loop through a public edge from the same laptop is not proof
of a complete match between separate physical locations.
