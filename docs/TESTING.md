# Verification contract

## 5.1 licensing acceptance (pending implementation verification)

Deterministic tests must exercise explicit trial start/expiry, paid activation, activation limits, deactivation, suspension/revocation, offline grace and fresh offline denial, entitlement guards, cached-state tampering, data preservation and actual HTTP Program continuity. Production Electron/package smoke must prove fail-closed missing configuration and absence of a mock bypass. Development test builds remain separate. Real Cryptlex policy/device/activation tests require owner configuration and cannot be inferred from mocks. Record final results after running the checks.

## Local evidence — 21 September 2026

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
