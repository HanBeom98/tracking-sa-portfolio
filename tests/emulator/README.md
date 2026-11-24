# Firestore and Storage integration tests

These tests use only the local Firestore and Storage emulators with the demo project `demo-trackingsa-ownership`. They create and remove test data inside the emulators; no production credentials are needed. Run from the repository root with Node.js 24 and Java 21 available.

The root unit-test suite deliberately does not load these optional emulator dependencies. In a disposable checkout or local test environment, install the tested tools without changing the project manifests:

```sh
npm install --prefix tests/emulator --no-save --package-lock=false firebase-tools@15.34.0 @firebase/rules-unit-testing@6.0.0 firebase@13.0.0
npm run test:emulator
```

On Windows use `npm.cmd`. The Firebase CLI may download emulator binaries on the first run. Ports 8085, 9098 (Auth browser suite), 9198, 4401 and 4502 must be available.

The `Project Validation` workflow installs these exact tool versions with Java 21 and runs this command on main pushes, pull requests and before manual site deployment. It needs no production secrets. Files run sequentially because they share the demo database. The command starts and stops the local emulators automatically and fails CI if any test fails.

The runner resolves this folder's rule paths into a temporary repository-root config, since Firebase CLI rejects rules outside its config directory. It removes that config when the command finishes, including on test failure. Source rules and the production Firebase config stay unchanged.

The suite verifies author uploads, forged paths and URLs, admin edits, removal of invalid historical references, anonymous/foreign deletion denial, text-only posts, and image type/metadata constraints. Client deletion filtering and upload rollback are tested separately by `tests/unit/board-attachment-ownership.test.js`.

For an isolated dependency directory, the identical `.mjs` test may be copied there to resolve its dependencies. Set `TRACKING_SA_RULES_ROOT` to the repository root so it still loads the real rules under test. This was the setup used for the initial verification.

`discord-session-security.test.mjs` additionally verifies that anonymous, ordinary and site-admin clients cannot write recruitment sessions, while the signature-verified server logic can use privileged transactions. It uses a generated local test key and the emulator-only rules bypass API; it does not send Discord messages or use production credentials.


`crew-settlement-concurrency.test.mjs` runs the real repository against separate authenticated Firestore clients. It verifies concurrent distinct/duplicate/overlapping matches, atomic manual penalties and repair, roster consumption, staff permissions and unauthorized rollback. Run the files sequentially (`--test-concurrency=1`): they share the demo emulator database and clear their own fixtures. No production matches or Discord messages are sent.

`crew-repository-workflows.test.mjs` also races approval against rejection for the admin dashboard. Exactly one pending decision commits; existing scores and nickname aliases survive, and caller-supplied nickname/OUID values cannot override the stored application.

`auth-nickname-transaction.test.mjs` verifies site-account nickname transactions: initial claims, competing users, atomic rollback, old-name release, case-only and unchanged saves, cooldown enforcement, missing legacy indexes, normalized paths, and canonical Firestore-to-Auth repair. It uses fake Auth display updates with real authenticated Firestore clients; it never changes production accounts or game/league nickname history.

`board-identity-privacy.test.mjs` verifies registered nickname requirements for posts, notices and comments, rejected author/email forgery, retained ownership and rate limits, and the legacy privacy migration. The migration tests use only the local demo REST endpoint with an emulator admin token. They verify audit-only mode, restricted private backups, orphan-comment discovery, idempotency and atomic rollback on concurrent edits.

Authenticated browser flows use the same local demo project with Auth on port 9098 and production Firebase 8.10.1 browser bundles served locally. Install the optional browser SDK and run `npm run test:e2e:auth:local`; see `tests/e2e/README.md` for setup and coverage. CI runs all 11 flows after this suite.

The board attachment suite also checks the shared access policy against actual rules: both site admin emails can publish notices and delete board images, three league-only moderators can manage crew records but cannot publish notices or delete board images, ordinary members stay blocked and existing admin profiles retain site privileges. The pre-R09 integration suite had 48 scenarios; six repository workflows bring the combined suite to 54.

The settlement suite also runs two authenticated clients against one member under their temporary and original nicknames. Both results must survive transaction retries while nickname aliases, migration metadata and idle members with zero wins/losses stay intact. Settlement calculation is in `domain/crew-settlement.js`; `infra/crew-settlement-store.js` rereads every candidate on each retry, then saves the complete plan atomically. Reports escape only after the commit succeeds.

`crew-repository-workflows.test.mjs` exercises the composed repository with the real SDK and rules: temporary-name reversion and alias query order, historical-name deduplication and zero-match ranking, legacy identity migration/removal, UID-owned applications with atomic unauthorized approval denial, nickname-only manual-history backfill and pending rosters, and season archive/reset/reseed/repair. Its compat adapter changes SDK syntax only. No production members, game APIs or Discord messages are used.
