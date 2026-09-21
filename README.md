# NewsRelay

Broadcast News Automation by S-AI Media Works.

NewsRelay 5.0.0 is a local-first Windows desktop newsroom for ingesting sources, preparing an editorial rundown and playing broadcast graphics through an authenticated OBS Browser Source. The repository is public; no application license has been selected by the owner. Public source availability is not an open-source license.

Canonical repository: https://github.com/sergio4848/NewsRelay. Development branch: `feat/newsrelay-v5-productization`.

## Operator workflow

Incoming → Preview → TAKE → Program. Manual operation is the default. Assisted mode queues Official/Trusted sources. Auto-Air also requires explicit source permission and minimum priority. HOLD freezes Program while ingestion continues. CLEAR blanks Program and returns to Manual. Restart recovers Incoming/rundown but deliberately leaves output blank.

Choose Demo mode for an offline rehearsal in a separate database. Settings provides OBS connection copying and a separate test-output URL. Customers use the Windows installer; Node.js, npm and terminal commands are development requirements only.

## Development

Use Windows x64 and Node 24 LTS (24.15+ recommended), with npm and Git. Clone this repository, then:

```sh
npm ci
npm run dev
```

The explicit postinstall downloads the pinned Electron runtime. `dev` builds and opens Electron; it does not run a hot-reload server.

| Command                 | Purpose                                         |
| ----------------------- | ----------------------------------------------- |
| `npm run typecheck`     | Strict TypeScript                               |
| `npm run lint`          | ESLint                                          |
| `npm run format:check`  | Prettier                                        |
| `npm run test:run`      | Domain and integration tests                    |
| `npm run test:smoke`    | Built Electron, real SQLite/vault/output        |
| `npm run build`         | Renderer, main, preload and third-party notices |
| `npm run package`       | Unpacked Windows application                    |
| `npm run dist:win`      | NSIS installer                                  |
| `npm run security:scan` | Tracked-content secret and path checks          |

Run `build` before smoke. The unsigned installer is emitted under `release/NewsRelay-Setup-5.0.0.exe`. Generated binaries, data and dependencies are ignored and do not enter source history. Signing and automatic updates are not configured.

## Architecture

- `src/core`: validated source-agnostic models and editorial rules.
- `src/connectors`: X recent search/lazy media, RSS/Atom, canonical REST JSON, authenticated local webhook and demo fixtures.
- `src/persistence`: versioned SQLite WAL transactions, bounded history and persistent operational snapshots.
- `src/main`: sandboxed desktop lifecycle, named IPC, safeStorage vault, orchestration and native import/export dialogs.
- `src/renderer`: React control room and English/Turkish operator UI.
- `src/graphics`: Headline, Breaking, Quote, Media and Ticker.
- `src/output`: independent loopback output, scoped capability authorization, bounded reconnect.

The core does not consume X response objects. New integrations implement SourceConnector. REST/webhook require the documented canonical data shape; arbitrary proprietary APIs are not claimed.

## Security and verification

Renderer has no Node access. IPC validates sender/frame and payloads. Credentials are OS encrypted and excluded from snapshots and portable configuration. Outputs expose Program only; no web-accessible operational command channel exists. Source content is rendered as text. Diagnostics export uses an allowlist and redaction.

Read [the legacy audit](docs/LEGACY_AUDIT.md), [security model](docs/SECURITY.md), [test evidence](docs/TESTING.md), [release review](docs/RELEASE_REVIEW.md) and [operator guide](docs/user/README.md). Automated checks do not replace real OBS, live-provider and Windows installation acceptance.
