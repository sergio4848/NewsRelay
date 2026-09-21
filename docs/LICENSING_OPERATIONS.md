# Licensing operations

Configure Cryptlex in its administration portal; no management token belongs in NewsRelay. Supply distributable Product ID and Product.dat contents through the ignored local build configuration described in config/licensing.example.json. Public contact/legal fields are optional; empty entries remain disabled. Rebuild the production package after configuration. Never distribute a test build.

Create one linked verified trial policy: 7 days, one machine, no automatic start. Do not use ActivateLocalTrial or Reset. Device matching is provider controlled; reinstalling app preferences does not grant a fresh trial. Hardware changes can affect matching, so do not promise invulnerable anti-tamper.

Professional: node-locked license, signed metadata `newsrelay.edition=Professional`, allowedActivations=2 for one production and one standby workstation. This is two activation slots, not enforcement of which machine is the standby. Configure finite serverSyncGracePeriod=604800 seconds (7 days), serverSyncInterval=3600, and clock validation enabled. Assign existing feature entitlement names from LICENSING_ARCHITECTURE.md with string value `true`. Set actual commercial expiration in the portal; do not infer a subscription from local preferences.

Enterprise: same binary, signed metadata `newsrelay.edition=Enterprise`, externally provisioned expiration/activation policy and feature set. A pilot may be issued for 14 days in the portal. No local enterprise grant, billing portal or floating-license implementation exists.

Activate on each workstation. Deactivate from Settings → License before moving a seat. Network failure during deactivation retains the provider's actual state; it must not report that a server seat was released. Administrator recovery uses Cryptlex activation management. Application uninstall preserves editorial data and does not automatically release a seat.

Validation uses signed local state; remote refresh detects suspension/revocation subject to connectivity and the configured grace window. Offline cannot learn a remote revocation instantly. The app requires finite paid grace and never invents seven days from its own last-seen cache. Missing/misconfigured edition, license type or entitlements denies corresponding use. Offline request/response file activation is an SDK capability but no customer file exchange UI is shipped in this phase.

Release gate: configure product/policies; test a real trial, Professional two-seat/third-seat denial, Enterprise pilot, invalid keys, deactivation/reactivation, expiry, revocation, offline recovery and native packaged execution on a clean workstation. Sign the installer and verify OBS physically. Deterministic fixtures are not evidence of live provider acceptance.
