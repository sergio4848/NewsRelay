# Verification contract

## 5.1 licensing evidence — 22 September 2026

Windows x64, Node 24.4.1, Electron 44.4.3, official @cryptlex/lexactivator and native library 3.45.0. **80 Vitest tests pass across five files**. Typecheck, ESLint, formatting and production build pass. Staged secret-pattern/forbidden-path scanning passes; licensing credential-keyword matches were manually reviewed and contain API/type references, runtime credential handling or obvious fictional fixtures.

Coverage includes explicit trial start and mock device-store persistence; trial failure/expiry; Professional and Enterprise activation; invalid keys and activation limits; deactivation/retry; suspension/revocation; verified offline grace, expiration and fresh offline denial; missing configuration; feature gates in Newsroom; forged SQLite grants ignored; expiry/clock status normalization; bounded stale-worker authority; license-key/diagnostic redaction; expired device details; failed observers; and denied in-flight ingestion after revocation.

Real SQLite and HTTP tests preserve Program, source configuration, theme, items, rundown, existing history, cursor and credential records through expired/suspended/revoked/error transitions. TAKE/NEXT/compose/ingestion deny, Auto-Air disarms, HOLD/CLEAR remain available and renewal does not re-arm. Revoked custom branding preserves the active graphic but blocks new custom playout; restoring default branding after CLEAR is permitted.

`npm run test:smoke` passes: separate test bundle requires explicit trial start; real Electron IPC, paid fixture activation/deactivation, denied TAKE after deactivation, live output DOM and reload continuity, encrypted source credential, restart/rundown recovery, demo separation and TR UI. Production smoke independently proves missing configuration denies trial/activation/composition even with mock-like environment variables, contains no mock implementation and displays EN/TR Settings. The SDK's native GetLibraryVersion executes successfully in the production worker.

`npm run dist:win` succeeds. The same production smoke passes against `release/win-unpacked/NewsRelay.exe`, verifying the SDK addon/DLL load from the packaged ASAR/unpacked layout. Installer: `release/NewsRelay-Setup-5.1.0.exe`, 121698568 bytes, SHA256 `D44BFC8ADE4FB042BDDC4CEA57A00676B3E24F602F71D70BB7FC0C2C3DF1C38D`, Authenticode **NotSigned**, executable product version 5.1.0.0. This is an unconfigured engineering package, not a ready-to-sell licensed installer.

During verification, the first SDK inspection in Playwright failed because its evaluation context does not accept dynamic imports. The production worker now reports only its safe library version; both development and packaged native checks pass. The expanded secret scanner initially referenced content before initialization; fixed and rerun successfully. Neither was a production license grant failure.

Not run: real Cryptlex product trial/paid activation, real device limits/deactivation/reinstall fingerprint behavior, provider-backed offline restart/revocation, clean-account installer install/uninstall, physical OBS and code signing. These need owner configuration and external acceptance. Mock tests cannot certify those behaviors. CI now runs all deterministic tests, both Electron build modes, NSIS packaging and packaged production smoke without production credentials. Hosted run outcome is reported separately in the delivery report.

## Historical 5.0 evidence — 21 September 2026

Windows x64, Node 24.4.1, Electron 44.4.3. Strict type checking, ESLint and Prettier pass. Vitest: **37 tests pass across three files**, including X pagination/lazy media with HTTP fixtures, canonical REST and RSS/Atom, response limits, all editorial modes, permission revocation, hold/next/clear/reorder, blacklist, duplicate provenance, priority bounds, schema validation, legacy migration, redaction, real SQLite migration/rollback/reopen and real authenticated loopback HTTP requests.

Production build passes. Electron smoke passes against both the development build and the packaged `release/win-unpacked/NewsRelay.exe`: Node unavailable in renderer; isolated offline fixtures; Preview/TAKE/HOLD; navigation preserves Program; real output DOM and refresh; OS safeStorage encryption verified by absence of the test credential from SQLite bytes; restart returns to blank Manual with recovered rundown; Turkish UI; manual composition; CLEAR; live/demo isolation.

NSIS build succeeded: `release/NewsRelay-Setup-5.0.0.exe`. Windows metadata verified as NewsRelay / S-AI Media Works / 5.0.0. Authenticode status is **NotSigned**; builder's generic signing-stage log is not proof of a signature. No certificate was supplied. The installer itself has not been installed/uninstalled in a clean Windows account.

Observed failures and fixes: Vite/esbuild peer mismatch corrected; installed npm 11.4.2 resolver crashed, a newer npm completed dependency resolution (with an engine warning on local Node); sandbox denied esbuild ancestor-directory reads, so build used authorized normal-user execution; added X pagination test caught URL validation rejecting `next_token`, corrected only for the exact X search endpoint; packaged output screenshot timed out with a hidden window, fixed by enabling offscreen rendering in the test harness. Final corresponding checks pass. npm dependency audit reported zero vulnerabilities during install.

External gates still open: live paid X account, customer-specific API endpoints, physical OBS source validation, clean-machine installer lifecycle, signing and release/update infrastructure. Hosted CI status is separate from these local results.

The first hosted Windows CI run failed formatting because checkout converted text to CRLF. `.gitattributes` now enforces LF at checkout, preserving the formatter contract across Windows machines.

The next hosted run passed installation, security scan, formatting, typecheck, lint, all 37 tests, build and Electron smoke. Its packaging step created the installer but then failed because electron-builder inferred release publishing from CI and requested GH_TOKEN. Packaging scripts now explicitly use `--publish never`; CI uploads a workflow artifact without attempting a release or requiring a personal token.

Required local checks: npm run format:check, npm run typecheck, npm run lint, npm run test:run, npm run build, npm run dist:win.
Tests must cover actual reducer transitions (Manual/Assisted/Auto-Air, hold/next/clear/reorder), normalization, blacklist, dedupe provenance, priority, import validation, redaction, SQLite migrations/recovery, legacy transforms and output authorization.
Electron smoke must launch the real built app, exercise offline Preview → Program, HOLD/CLEAR and isolated demo restart. Output tests must verify unauthorized requests, scoped projection and safe content rendering.
Release acceptance also requires physical OBS/browser source test, live X/RSS/customer endpoint tests, Windows install/uninstall and code-signing infrastructure. Record actual evidence here at completion; no unrun gate may be called passing.
