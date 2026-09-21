# Verification contract
Required local checks: npm run format:check, npm run typecheck, npm run lint, npm run test:run, npm run build, npm run dist:win.
Tests must cover actual reducer transitions (Manual/Assisted/Auto-Air, hold/next/clear/reorder), normalization, blacklist, dedupe provenance, priority, import validation, redaction, SQLite migrations/recovery, legacy transforms and output authorization.
Electron smoke must launch the real built app, exercise offline Preview → Program, HOLD/CLEAR and isolated demo restart. Output tests must verify unauthorized requests, scoped projection and safe content rendering.
Release acceptance also requires physical OBS/browser source test, live X/RSS/customer endpoint tests, Windows install/uninstall and code-signing infrastructure. Record actual evidence here at completion; no unrun gate may be called passing.

