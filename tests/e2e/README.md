# Local authenticated browser integration tests

This suite loads the generated site and the same Firebase 8.10.1 browser bundles used in production. It uses real Auth and Firestore SDK operations against the demo project `demo-trackingsa-ownership`. Only fixed loopback origins (4173, 8085, 9098, 9198) can reach the network. Firebase CDN requests are fulfilled from the local SDK package; every other external request is blocked. No production account, content or Discord message is changed.

From the repository root, with Node.js 24, Python 3.11+ and Java 21:

```sh
npm ci
npm install --prefix tests/emulator --no-save --package-lock=false firebase-tools@15.34.0 @firebase/rules-unit-testing@6.0.0 firebase@13.0.0
npm install --prefix tests/e2e/sdk --no-save --package-lock=false firebase@8.10.1
npx playwright install chromium
npm run build
npm run test:e2e:auth:local
```

Use `npm.cmd`/`npx.cmd` in Windows PowerShell when needed. Optional tools are installed in separate test directories, so they do not update the root Playwright version or production lockfile. The runner automatically starts Auth, Firestore and Storage emulators, then shuts them down and removes its temporary configuration. Browser setup starts and stops the local HTTP server.

Each scenario clears only the local demo Auth/Firestore fixtures. Accounts are created through the Auth emulator REST API. The admin fixture receives an admin profile through the local emulator's owner endpoint solely to provision that scenario; all application writes then use the signed-in browser and real security rules. Normal profiles, nicknames, posts and comments are created through the application.

Coverage:
- The admin dashboard restores a real site-admin profile, shows its header link and notice list, approves a pending application without resetting an existing member's scores, and clears private content on logout.
- Guest and invalid-password access; valid login still requires a registered site nickname.
- Nickname save/reload and ordinary post persistence with canonical author UID/name and no email.
- Persisted login with delayed Firestore response; no spurious login modal.
- Logout locks the open form and subsequent unauthenticated writes fail.
- Ordinary notice forgery is denied; admins also need a nickname before creating a notice.
- A nickname-less reader follows the account link without another login prompt, sets a nickname and saves a comment with their own identity.
- Blocked session storage still permits real email login, nickname setup and post creation.
- Image cleanup uses real Storage uploads/deletes, retries an injected transient disconnect, verifies a missing object and reports an actual signed-out deletion denial without removing that object. All objects stay in the loopback demo bucket.
- The shared auth adapter revokes comment writing and account access on logout, and restores/revokes the league staff menu using a disposable local staff fixture. No league match or settlement is created.
- Notice creation, editing and deletion update the home banner through actual emulator REST results and invalidate the previous browser cache. Only the exact demo-project REST query URL is fulfilled from port 8085; other external Firestore projects remain blocked.

The root Playwright config and standard `test:e2e`/`test:e2e:smoke` aliases use this fixed local suite. `test:e2e:auth` delegates to the local authenticated runner. The optional deployed smoke uses only `npm run test:e2e:production` with `playwright.production.config.js`; its `TRACKING_SA_BASE_URL` does not override either local config.

The `test:e2e:ci` browser checks remain independent of Firebase. They include a stale English language preference, Korean aliases, decomposed Hangul/fullwidth English, multi-term and description search, preserved English result titles, and the normalized minimum query length on the existing search page. Guide discovery also covers desktop/mobile navigation, horizontal overflow, home links to worked examples, and searching for an existing analysis article. A local-only zero-match fixture also renders public, league and VS cards through the real stats component after the renderer split. Local proxy fixtures verify timeout/rate-limit search guidance, preserved input and retry controls, and SOOP timeout placeholders. Existing production-targeted smoke tests remain separate and are excluded from this local suite. The authenticated suite is mandatory in Project Validation and in the shared deployment gate after the rule integration tests.

Additional local smoke scenarios cover growth item 8. Added cases verify KPI ordering with expandable sharing, 44px favorite controls and VS dialog focus; explicit PNG recovery from a pending mocked clipboard with one completion; responsive share labels; and unresolved fonts/decorative rank images completing without automatic retries. All clipboard/share/download and external API operations remain fixtures. These checks do not certify physical iPhone/Android behavior or a production deployment.

## Theme regression checks

Run the focused suite with `npm run test:e2e:ci -- board-theme.spec.js` (`npm.cmd` on Windows). It uses local components and generated pages with external requests blocked.

`board-theme.spec.js` owns the visible contrast contracts formerly checked by the board-edit, app-layout and guide CSS-string unit tests:

- Board text, edit controls and the app-layout content surface are checked in both themes and viewport sizes, including the fallback without `:host-context` rules and an in-page theme change.
- About/contact cards, guide card headings and descriptions, the stats hub and the existing player-search badge are checked using rendered colors and their painted backgrounds. Slotted content includes the shadow card when resolving its background.
- Each required selector must exist. Text contrast must be at least 4.5; dark cards must retain a dark, opaque surface. Exact hex values and the spelling of CSS declarations are not the contract.
- CSS transitions finish before measurement so a newly selected theme cannot pass using the previous theme's colors.

Add new text targets to the existing page cases where possible rather than duplicating source-string checks or repeating a full navigation flow for every theme.

## Responsive layout and shared behavior

Keep viewport/theme matrices for geometry, visible entry links, mobile menus and print media. Exercise shared behavior in a focused flow rather than repeating its entire journey in every theme:

- `mygun2.spec.js` checks home, guide navigation and catalogue/comparison layout together for each viewport/theme. The search flow follows the home and navigation links to their real destination once. Mobile menu opening, link visibility and destination attributes remain in the matrix.
- `replay-polishing.spec.js` keeps file selection, comparison controls, result hierarchy, KPI arrangement and playback/records navigation layout in the matrix. Keyboard comparison, playing while navigating records, filtering and opening the report share one separate behavior test.
- `replay-print-report.spec.js` keeps screen/print dimensions and dismissal checks in the matrix. Its lifecycle test owns the filtered-analysis report, print callback/title restoration, reopen/close behavior, playback pause and reset cleanup. Delayed loading, import failure and long/partial reports remain separate regressions.

These changes do not change test workers, timeouts or required CI jobs. Compare timings with the same local configuration and treat a single before/after run as a measurement, not a guarantee for CI or other machines.
