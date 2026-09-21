# Product specification

NewsRelay 5.0.0 is a local-first Windows application for source ingestion and editorial broadcast playout. No online account is required for demo/manual operation.
Workflow: connectors → normalization → blacklist → deduplication → priority → editorial rules → rundown → Preview → Program → outputs.
Manual admits incoming only. Assisted queues enabled Official/Trusted sources; operator takes. Auto-Air requires enabled, Official/Trusted, explicit per-source permission and minimum priority. Each progression rechecks permission. HOLD freezes Program; CLEAR blanks and returns to Manual. Selecting/editing Preview never modifies Program.
Sections: Control, Sources, Templates, History, Settings, Diagnostics. Offline fixtures use a separate database and conspicuous demo status. Configuration import never arms Auto-Air. Provider connectivity, code signing and OBS acceptance cannot be claimed without testing.
