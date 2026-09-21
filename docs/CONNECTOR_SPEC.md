# Connectors
SourceConnector exposes identity/metadata, validation, start/stop, health, poll, normalize, error and rate-limit information. All normalized items have internal/external IDs, connector/provider/publisher identity, headline/body/url/time/media, trust/group/priority, provenance, editorial and broadcast states.
X uses recent search with per-source cursor and opt-in lazy attachment expansion. Replies and reposts are configurable. RSS/Atom supports entries/items without executing markup. REST JSON and local webhook accept documented canonical fields: id, headline, body, url, publishedAt, publisher, media. These are not arbitrary proprietary API integrations.
HTTPS is required for outgoing provider/media URLs; credentials belong only in the vault, never URL/config. Requests have timeout, body-size limits, non-overlapping polling and bounded backoff. Webhook is local-only with its own token, POST only, bounded body and strict schema. Demo emits explicitly fictional offline fixtures.
Cursors advance only with successful durable ingestion. Provider errors are status codes, not reflected response bodies. Rate-limit headers are exposed as bounded numeric diagnostics.

