# Security and threat model

Licensing: trust the native SDK's signed activation, not SQLite or renderer state. Production cannot load mock providers. Provider calls run in a worker; only safe status/entitlement fields cross the boundary. No license key is cached by NewsRelay (SDK encrypted storage owns it). No raw SDK errors or device data in diagnostics. Public Product.dat is distributable; administration credentials never belong in the application. Confirmed license failures deny new work without blanking existing output. See LICENSING_PRIVACY_NOTES.md.

Protect credentials, editorial integrity and private source data against hostile feeds, imports, web origins and unauthorized loopback clients. An attacker with the same Windows user's full filesystem/process access is outside the protection boundary.
Renderer: contextIsolation, sandbox, no nodeIntegration, deny navigation/new windows/permissions, restrictive CSP, validated sender frame and named IPC. No arbitrary path, shell or process bridge.
Credentials: Electron safeStorage with Windows OS encryption. Refuse plaintext fallback. Tokens never return in snapshots/exports/errors. Native credential input passes transiently through renderer, is cleared after save; no secret retrieval API.
Output: loopback only, exact Host/Origin checks, 256-bit separate capability tokens for output/webhook. No remote operational commands. Output URLs are capabilities: clipboard sharing is deliberate. No logging request URLs.
Source/import schemas are bounded; URL credentials/query authentication forbidden in configuration. No source HTML injection. Diagnostics use an allowlist and redaction. Never include source contents, user paths, vault, raw provider bodies or operational database.
Publishing gate: staged diff plus credential-pattern scan; runtime and archives ignored. Public repository has no selected license.
Unsigned Windows packaging is acceptable for testing only; signing, publisher validation and update/release infrastructure remain owner tasks.
