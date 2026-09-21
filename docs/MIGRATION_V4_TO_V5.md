# v4.1 migration
Choose Settings → Import legacy tracking and select tracking.json. Import accounts, groups, enabled flags, tier-to-trust mapping (official→Official, tier1/reporter→Trusted, media→Standard, other→Unverified), blacklist, reply/repost preferences and polling interval (live 30s, economy 120s). Paused remains disabled.
Auto-Air permission is always false on import; old autoQueue is not authorization. Credentials are never read from .env. Enter credentials through Sources to encrypt with Windows safeStorage. A legacy folder containing .env must keep it private; do not include it in exports.
The supplied archive contains no accounts and no .env. Migration tests use fictional tracking data. Volatile old queue/history cannot be recovered from the supplied archive. Stale cost estimates/cursors are discarded. FLASH/NEWS/MEDIA correspond to Breaking/Headline/Media; position/display JSON was not persisted by legacy, so new safe defaults apply.

