# Connectors

SourceConnector exposes identity/metadata, validation, start/stop, health, poll and normalize. All normalized items have internal/external IDs, connector/provider/publisher identity, headline/body/url/time/media, trust/group/priority, provenance, editorial and broadcast states.

X uses recent search per configured handle with a durable cursor. Continuation pages retain the original since_id/start_time until all pages are read. Replies/reposts are configurable. Attachments load only on request using the single-post expansion endpoint. Source response types remain inside connectors. Live access requires customer credentials and API entitlements; it has not been exercised with a paid account.

RSS/Atom supports items and entries, removes markup, rejects DTD/entity declarations and bounds records. REST JSON expects an array (maximum 200) of canonical objects. Webhook expects one canonical object, POST on loopback with a separately generated Bearer capability. Fields: id, headline, body, url, publishedAt, publisher and media. Media supports HTTPS image/video URLs. No arbitrary field mapping or proprietary API support is claimed.

Requests enforce HTTPS without embedded credentials, deny redirects, cap response size at 2MB and time out after 15 seconds. Non-overlapping scheduler uses bounded exponential backoff to 15 minutes. X rate-limit remaining/reset headers are available in health; request counters are session-local, not billing. Cursors commit with successful ingestion. Provider failure details are sanitized to a stable code. Empty valid polls update health. Paused sources are disabled.

Demo emits three fictional offline fixtures in an isolated database. Manual editorial composition does not pass through a network connector and cannot automatically authorize itself.
