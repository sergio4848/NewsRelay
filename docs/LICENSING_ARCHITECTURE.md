# Licensing architecture — 5.1

Audit: existing Electron main owns Newsroom, SQLite, safeStorage and the loopback output. React receives named IPC snapshots. Preserve these boundaries and database schema 1. Foundation branch is feat/newsrelay-v5-productization; main currently contains only the initial repository commit. Licensing builds on that reviewed foundation, without rewriting its history.

LicenseProvider returns a bounded, provider-neutral LicenseState. CryptlexLicenseProvider runs the official pinned @cryptlex/lexactivator 3.45.0 native SDK in a worker. LicenseService in main owns the latest verified state and the entitlement policy. The renderer receives only an allowlisted projection. No SDK network operation runs on the playout thread or in TAKE.

Use SDK local signature validation at startup and periodically. Refresh remotely in background and on explicit request. SDK signed expiry, sync-grace expiry and clock checks are authoritative. No SQLite value, configuration import, renderer command, environment variable or demo fixture can grant access. A stalled worker has a bounded freshness lease; new operations fail closed while existing Program stays visible.

Statuses: UNINITIALIZED, TRIAL_AVAILABLE, TRIAL_ACTIVE, LICENSE_ACTIVE, OFFLINE_GRACE, EXPIRING_SOON, TRIAL_EXPIRED, LICENSE_EXPIRED, LICENSE_SUSPENDED, LICENSE_REVOKED, ACTIVATION_LIMIT_REACHED, VALIDATION_ERROR. Network/clock/configuration errors are normalized separately. A failed activation must not fabricate an active state. Fresh offline installations receive no grant.

Implemented feature IDs: connector.x, connector.rss, connector.rest, connector.webhook, workflow.auto_air, branding.custom, output.obs. Paid entitlements come from signed SDK feature entitlements (value `true`); absent/expired flags deny. Evaluation enables these existing features for a verified provider trial. Editions are Evaluation, Professional and Enterprise; Enterprise does not imply unimplemented functionality.

Broadcast boundary: confirmed invalidity blocks new ingestion, composition, edits, TAKE/NEXT, Auto-Air and branding changes. HOLD and explicit CLEAR remain reachable. License transitions never modify Program, stop output HTTP, reload graphics or quit Electron. In-flight ingestion is rechecked before commit. Existing Program remains readable until operator CLEAR or normal app exit. This does not permit continued unpaid playout: no new story or automatic advance is allowed. Renewal restores eligibility, not automatic arming. Diagnostics, history, license management, language and configuration export remain accessible.

Mock providers exist only in test sources and a separate development test build. Production bundles contain no mock import or runtime license bypass. Packaging rejects test builds. Missing public product configuration yields a clear configuration error. SDK loading failures also deny new operations.

Official references checked 21 September 2026: [SDK](https://cryptlex.com/docs/sdks-and-apis/lexactivator), [trials](https://cryptlex.com/docs/licensing-models/timed-trials), [node-locked](https://cryptlex.com/docs/licensing-models/node-locked-licenses), [policy fields](https://cryptlex.com/reference/web-api/post-licenses). SDK declarations/source installed from the official npm package define the exact API contract.
