# Release review

This is an implemented and locally verified 5.1.0 licensing integration on the 5.0 foundation, not a certified broadcast deployment. Live provider provisioning and production acceptance remain external gates.

## Licensing adversarial review

Security: renderer supplies only a validated activation request or fixed contact ID. Worker is the only native SDK caller. No local license cache is authoritative, no test provider is imported into production, no runtime environment can grant access, and the packaged native SDK was executed. Management credentials, device fingerprints, raw provider errors and license keys never enter snapshots or diagnostics. The SDK owns encrypted activation storage. Public configuration is build-time, schema constrained and missing configuration denies access. Same-user code/process tampering remains outside the trust boundary; signing is still required for distribution.

Broadcast operations: license callbacks only disarm automation and notify; they never advance or clear Program. TAKE consults in-memory entitlements without network waits. HTTP output stays alive across invalid states. Existing Program keeps its theme; lost branding permission cannot authorize another custom TAKE. Imports validate permissions before any deliberate CLEAR. A failed license observer cannot become an unhandled rejection. Existing graphics may remain visible indefinitely, but no new playout/ingestion is permitted without entitlement.

Commercial licensing: a trial requires the provider and an explicit action, never installation date or local preferences. Two Professional slots represent production/standby policy, not role enforcement. Enterprise is externally provisioned; absent features deny. Finite provider grace is required and bounded by signed expiry. Revocation cannot be discovered instantly while disconnected. No payment automation, customer portal, floating lease lifecycle or future enterprise capability is falsely claimed.

Enterprise IT/customer: configuration/history/credentials survive license transitions and schema remains version 1. Activation details, errors, license management, export and diagnostics stay reachable; all new UI strings have EN/TR equivalents. Public engineering builds display their missing product configuration rather than granting a mock trial. Actual policy setup, live workstation acceptance, clean installation and signing must precede customer distribution. See TESTING.md for evidence and exclusions.

## Operator review

Separate Preview and Program; selecting an item cannot take it. HOLD blocks all progression; CLEAR is deliberate and disarms Auto-Air. Restart restores rundown but requires operator re-arming. Incoming edits survive unrelated state updates. Per-source permission/trust/priority are checked for every automatic transition. New manual stories stay in Preview. Output remains independent of desktop navigation.

## Architecture review

Provider payloads stop at connector normalization. Transactional SQLite replaces loose JSON operational files. Boundaries have strict schemas and collections have retention caps. No generic IPC, plugin loader or speculative proprietary integration exists. Known scale limit: bounded snapshots are synchronous SQLite operations in main; load testing on target broadcast hardware is still needed for unusually high ingestion rates.

## Security review

OS-backed credentials, namespaced source/output/webhook keys, read-only loopback output, Host/Origin checks, bounded requests, restricted CSP, sandboxed renderer, sender/frame validation and text-only rendering. Unknown webhook requests cannot create vault entries. No signed-update claim. Imported configuration cannot carry credentials or arm Auto-Air. Local malicious processes with user-level privileges remain outside the trust boundary.

## Customer/release review

Installer includes Electron and needs no Node/npm/BAT workflow. EN/TR UI and operator notes exist. Customer themes share code. No application license was invented. Third-party license texts are collected from actual dependencies.
External acceptance gates: live X access/customer endpoints, physical OBS studio validation, installer lifecycle testing on a clean Windows account, signing identity/certificate and update infrastructure. No real credentials were supplied or used. These gates must be completed before selling a supported production release.

## Intentional legacy differences

Forced automatic publication is removed. Football keywords and obsolete cost estimates are removed. X requests use a cursor per configured handle instead of multi-account query batching. Web outputs use read-only HTTP snapshots instead of command-capable WebSockets. Video is muted/looped; legacy transport controls are not migrated. Graphic placement is a controlled lower-third canvas rather than arbitrary card positioning. Archive, runtime tracking and environment values were not published.
