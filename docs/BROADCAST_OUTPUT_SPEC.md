# Broadcast output
OBS Browser Source is the initial output adapter. Server binds 127.0.0.1, stable automatically assigned persisted port, generated output-scoped secret. Settings copies the complete URL. 1920×1080, transparent background. Keep browser source active when hidden; refresh after application restart if needed.
Browser output receives Program and theme only, never incoming items, configuration or credentials. Read-only authenticated state retrieval is used instead of operational WebSockets; no WebSocket command endpoint exists. Origin and Host are checked. Reconnect uses bounded delay, no control commands.
Headline, Breaking, Quote, Media and Ticker share tokens/contracts. Media failure falls back to text; fixed canvas avoids layout shift. TEST OUTPUT is a separate test route and never changes Program.
Extension point: BroadcastOutput interface. Additional broadcaster adapters are not implemented.

