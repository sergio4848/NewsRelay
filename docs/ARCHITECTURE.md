# Architecture

Electron main owns an application service, SQLite repository, credential vault, connector scheduler and loopback output service. Sandboxed preload offers named, validated capabilities. React renderer is a projection of snapshots and sends bounded commands.
src/core contains schemas, normalization, priority, deduplication and a pure editorial reducer. src/connectors translates external payloads. src/persistence uses Node's bundled SQLite with WAL and transactional state/history/cursors. This avoids shipping a separately compiled native database module. Database version is explicit and newer schemas fail closed.
src/main owns orchestration/security and native dialogs. src/output serves a small browser renderer independently of desktop navigation. Graphics are shared React components with explicit content/theme contracts.
Real and demo databases/vault namespaces are separate. Retention bounds incoming/rundown/history. A transaction persists state and its audit event together. Restart retains items and rundown, blanks Program and selects Manual to avoid unexpected output.
No automatic updater is activated. Future releases require signed Windows packages, authenticated release metadata and electron-updater's established validation path; never download and execute arbitrary update URLs.

5.1 adds a licensing service shared by live/demo workspaces, with native provider operations isolated in a worker. Newsroom guards operational boundaries with in-memory entitlements; local SDK checks run every ten seconds and remote refresh runs hourly. SQLite is never a license authority. See LICENSING_ARCHITECTURE.md for broadcast continuity and production/test separation.
