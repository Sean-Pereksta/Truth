# Bannerlands campaign lobby directory

Bannerlands uses the existing Firebase project `bible-game-246c0` for lightweight
discovery. The downloaded host runs the simulation and carries commands and
world updates through its temporary connection. No battle snapshots, unit
positions, player-control credentials or host-control credentials are stored
in Firebase.

The full-game directory is the Firestore collection
`bannerlandsCampaignLobbies`. The earlier two-player tactical prototype keeps
its existing `bannerlandsLobbies` collection and rules. The web configuration
in `multiplayer/firebase-config.js` comes from that prototype. Its API key is
public web configuration; anonymous Firebase Authentication and Firestore
rules authorize writes. No service-account key is required or packaged.
Public browser discovery sends an unauthenticated Firestore REST query and
works independently of the Firebase SDK download.

## Publication and joining

The downloaded host uses `source/hosting/firebase-directory.mjs`. It signs in
anonymously, writes only the explicit metadata allowlist and uses a server-time
transform for `updatedAt`. One publisher owns one document at its own Firebase
UID. `directoryManaged` tells the browser interface that the host service owns
publication, preventing a second browser listing.

The listing contains the lobby identifier and name, unverified host display
name, token-free HTTPS host origin, victory mode, landscape, map size,
difficulty, fog setting, human seat counts, AI house count, status and exact
protocol/game/artwork versions. The current supported cap is **four humans**;
mode-permitted campaigns retain **sixteen total houses**, including up to
twelve AI houses with four humans. Empty configured human seats remain reserved
until the host changes the configuration; unchosen remaining houses use bots.

The host advertises only after the temporary connection passes its public
reachability check. Full, private, closed, disconnected and in-progress matches
are removed from the available-lobby view. A private guest invitation carries
its admission code in the URL fragment; it never goes into the directory.

Selecting Join in the website keeps the maintained game page and compatible
artwork on that website's origin, and connects its client to the selected host
through the authenticated cross-origin game API. The authoritative host checks
availability, atomically assigns a house and issues a new private guest session.
The browser remembers the selected host separately from its per-host private
session, so reloading recovers the same house. Switching lobbies leaves the
previous session and stops an owned hosting connection before joining another.
The directory is advisory and cannot reserve a seat.

Direct guest invitation links still open the temporary host's full-game page.
That path caches assets at that temporary origin. Website browsing or pasting
an invitation into the website's Join by Invite keeps its stable artwork cache
across different host addresses; direct links to newly generated temporary
addresses require a separate browser-origin cache.

## Frequency, expiry and usage

Hosts send at most one heartbeat every thirty seconds. The server can trigger
status changes or removal sooner. The browser fetches at most fifty newest
records using the existing single-field `updatedAt` index and caches that query
for thirty seconds. It rechecks expiry locally every five seconds. Records
older than ninety seconds are hidden even if no new Firebase event arrives.
The stale document can remain stored; a paid TTL-delete feature is not needed
for hiding it.

`createFirebaseDirectory().usage()` reports query count, estimated document
reads, writes, deletions, errors and estimated metadata bytes. Its byte figure
does not include transport overhead. The Node publisher reports its actual
JSON request/response bytes, authentication requests, writes and deletions.
These counters are session measurements, not a Firebase billing statement.

A continuously open waiting host has an upper heartbeat rate of 120 writes per
hour. A browsing client has at most 120 queries per hour: up to 6,000 document
reads when every query returns fifty records, with Firestore's minimum charge
for an empty query. Firebase is not assumed to be unlimited or free. Account
creation, abuse prevention and costs need review before a broad public release.

## Deployed rules and preservation

On November 16, 2026, the existing deployed source was fetched using the
authenticated Firebase CLI before preparing an additive collection rule.
The initial source had 145,395 bytes with SHA-256
`0089436d8e7d62b7c261b410411a58d33edb59d0bfb37bcb8d89359712b0da7d`.
Every original byte was preserved outside the new collection insertion.

After the user's four-human limit, the only subsequent edit narrowed the new
collection's `maxHumans` bound from sixteen to four. The effective deployed
release is:

- Ruleset: `913f2b7b-7f11-4f65-841d-feb5d332d338`
- Release update: `2026-11-16T22:38:23.208749Z` (5:38 PM New York)
- Effective source: 148,108 bytes
- Effective SHA-256:
  `db59456ab4084a76d63acc697280c31148955f5b8365d96d4fc8627f9ede416f`

The release and source hash were checked before staging and immediately before
activation; the effective source was fetched afterward and matched exactly.
The Releases API has no documented atomic compare-and-swap field, so these
checks are not a guarantee against a simultaneous external deployment.

`multiplayer/firebase-campaign-lobbies.rules` is an **additive fragment**, not a
replacement rules file. A future deployment must fetch the then-current rules,
merge only this collection's intended change, preserve all unrelated game rules,
test the combined result and verify the effective release. Never restore an
older repository copy over currently deployed unrelated rules.

## Validation

`source/tests/multiplayer-directory.mjs` passes twelve adapter checks covering
metadata privacy, expiry, compatibility, malformed invitations, bounded reads
and writes, publication/removal races and the Node host adapter's private
authentication and server-time transform. Public browsing also verifies that
no SDK or authentication request is made. A stalled directory request returns a bounded
failure, and a simulated hour-long host refresh verifies the documented form
encoding, refresh-token rotation and recovery after a temporary service error.

`source/tests/multiplayer-firestore-rules.mjs` passes nine checks against the
Firestore emulator using the complete current rules plus the new fragment.
They cover owner-only mutation, four humans plus twelve AI houses, rejection of
five humans, fifty-record query limits, unknown credential fields, unsafe URLs,
invalid counts and timestamps. Existing prototype publication, Basewar
authentication and default-deny behavior remain covered.

An actual temporary anonymous publisher successfully wrote and publicly read a
hidden `starting` test record. Its Firestore response was 1,153 bytes. A
`hostToken` injection was denied with HTTP 403. The record was removed and a
subsequent read returned 404; its temporary anonymous account was deleted.
That smoke run used one authentication request, one write and one deletion,
with 1,140 publisher JSON request bytes and 1,467 response bytes. This is a
small connectivity/security check, not a sustained load or billing benchmark.

The rules test requires the Firebase rules-test libraries and a local
Firestore emulator. Set `BANNERLANDS_FIRESTORE_RULES` to the complete candidate
rules file for existing-game regression checks and `FIRESTORE_EMULATOR_HOST` to
the local emulator address. Without an external rules file the test builds an
isolated directory ruleset. `BANNERLANDS_FIREBASE_TEST_MODULES` can point to an
installed test package's `package.json` when using a shared test runtime.

Official references: [Firestore rules](https://firebase.google.com/docs/firestore/security/get-started),
[server timestamps](https://firebase.google.com/docs/firestore/manage-data/add-data#server_timestamp),
[Firestore pricing](https://firebase.google.com/docs/firestore/pricing),
[Firebase token refresh](https://firebase.google.com/docs/reference/rest/auth#section-refresh-token) and
[Rules release updates](https://firebase.google.com/docs/reference/rules/rest/v1/projects.releases/patch).
