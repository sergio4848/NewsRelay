# Legacy audit — 21 September 2026

Input: local OBS_X_Son_Dakika_v4.1_Auto_OnAir.zip. Archive stays outside this repository. Read server.js, both public HTML files, package manifest, README, startup BAT, environment key definitions and runtime JSON structures. No .env was supplied. Tracking contains zero accounts, four blacklist terms, paused polling; usage counters are zero and cursors empty.
Remote inspection succeeded with no refs: canonical repository was empty. Clean main foundation precedes this branch.

## Behavior and coupling

One 21KB CommonJS server owns X requests, scoring, duplicate matching, timers, storage, HTTP routing and command sockets. 22KB admin HTML combines styling, state, rendering and controls. A 9KB overlay uses social-card graphics. Global inbox (180), history (150), queue and media cache are volatile. Tracking/cursors/usage use synchronous loose JSON; read failures silently reset defaults.
X queries batch up to eight accounts, exclude replies/retweets, maintain since_id, and poll at 30/120 seconds. Media is loaded on request. Provider response objects leak into operational state. Usage costs are hard-coded estimates, not authoritative billing.
Every non-blacklisted incoming item automatically reaches air or queue. Pin keeps Program while queue grows; unpin advances. Critical score maps to FLASH. A 14-word fingerprint or Jaccard >= .84 within group merges recent 50 stories, adds score and usernames. Priority uses tiers and football-specific keywords.

## Risks

Loopback bind is already present and preserved. HTTP state and WebSocket controls are unauthenticated with no Origin validation. Source text is interpolated into inline handlers; escaping HTML alone does not protect JavaScript contexts. Full state is sent to every output. Timers are not durable. Queue/cache unbounded. Broad catch blocks hide corruption and errors. UI needs explicit Preview and Program and keyboard operation. BAT assumes Node/npm; no installer, tests, type system or CI.

## Port decisions

Preserve polling/cursors, blacklist, group-scoped similarity, provenance, priority thresholds, lazy media, hold, timed progression and bounded history as domain behavior. Remove forced automatic publication and hard-coded sport vocabulary. Replace social cards, globals, unauthenticated commands and estimated billing. Safe defaults supersede unsafe legacy behavior; feature-specific deltas are documented in migration notes.
