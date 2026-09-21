# Security and threat model

Protect credentials, editorial integrity and private source data against hostile feeds, imports, web origins and unauthorized loopback clients. An attacker with the same Windows user's full filesystem/process access is outside the protection boundary.
Renderer: contextIsolation, sandbox, no nodeIntegration, deny navigation/new windows/permissions, restrictive CSP, validated sender frame and named IPC. No arbitrary path, shell or process bridge.
Credentials: Electron safeStorage with Windows OS encryption. Refuse plaintext fallback. Tokens never return in snapshots/exports/errors. Native credential input passes transiently through renderer, is cleared after save; no secret retrieval API.
Output: loopback only, exact Host/Origin checks, 256-bit separate capability tokens for output/webhook. No remote operational commands. Output URLs are capabilities: clipboard sharing is deliberate. No logging request URLs.
Source/import schemas are bounded; URL credentials/query authentication forbidden in configuration. No source HTML injection. Diagnostics use an allowlist and redaction. Never include source contents, user paths, vault, raw provider bodies or operational database.
Publishing gate: staged diff plus credential-pattern scan; runtime and archives ignored. Public repository has no selected license.
Unsigned Windows packaging is acceptable for testing only; signing, publisher validation and update/release infrastructure remain owner tasks.
