# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/). This is a
pre-1.0 beta; minor versions may change the bridge protocol.

## [1.0.0-beta.2] - 2026-10-22

Security-focused beta. The bridge protocol changes: the WebSocket no longer
accepts the bearer token in the query string, and clients must request a
one-time ticket from `POST /ws-ticket` first.

### Added

- Release-signed arm64 APK (`opencode-mobile-1.0.0-beta.2.apk`) attached to the
  public release, with a per-asset `.sha256` file and a regenerated
  `SHA256SUMS` covering every asset.
- The website download section now prints the APK SHA-256 digest.
- One-time, 30-second WebSocket tickets from `POST /ws-ticket`; tickets are
  consumed on first use and are rejected on replay.
- WebSocket `Origin` checks for browser clients. Native clients without an
  `Origin` header keep working; browser origins must be same-origin or listed
  in `CORS_ORIGINS`.
- Per-socket WebSocket message rate limiting.
- Per-session cumulative upload quota (`MAX_SESSION_UPLOAD_MB`, default 1024 MB).
- Release workflow certificate checks: debug-signed APKs are rejected, optional
  `ANDROID_KEY_CERT_SHA256` pinning, keystore permissions `0600`, and keystore
  cleanup.

### Changed

- The website is now a small set of pages instead of one long page. The home
  page is the install page with copyable commands, and each topic lives on its
  own page: features, guide, security, FAQ, and a documentation index.
- Documentation pages use a sticky sidebar with the page sections and an
  active-section marker.
- Every command block on the site has its own copy button.
- `ALLOWED_WORKDIRS` now gates session content reads, message sends, diffs,
  files, questions, permission responses, stops, deletes, and WebSocket
  subscribe/send/approval/stop actions, not only session creation and uploads.
- The Android release workflow passes signing environment variables to Gradle
  and configures the `release` build type without touching `debug`.
- CI checkouts set `persist-credentials: false`.
- Web export carries a stricter CSP, `Referrer-Policy: no-referrer`, and
  `X-Robots-Tag: noindex`; the static host config and Caddy add matching
  headers.
- Web attachment previews force HTML/SVG and unknown types to `text/plain`,
  keep raster images and PDFs previewable, use `noopener,noreferrer`, and
  revoke object URLs.
- Bridge responses to `/bridge/*` are marked `Cache-Control: no-store`.
- The app refuses absolute file URLs so the bearer token is never attached to
  a response-supplied external URL.
- `AUTH_TOKEN` validation rejects the shipped example value and low-entropy
  repeated tokens.
- Documentation now describes the ticket flow and the workdir enforcement
  boundaries.

### Removed

- The debug-signed APK from the beta 1 release. It was built with the public
  Android debug key, so it is no longer offered for download; the beta 2
  release-signed APK replaces it.

### Fixed

- Release workflow no longer replaces the debug signing config while trying to
  sign the release build.
- Website footer links no longer leak the referrer.
- Website GitHub star-count fetch has a timeout and fails quietly.
- The website star count is cached for 24 hours, keeps the last known value
  when the GitHub API refuses a request, and backs off after a `403` or `429`
  instead of retrying on every page view.
- WebSocket keepalive pings no longer count against the per-socket message
  limit, and that limit is raised to 300 messages per minute so a reconnect
  burst is not mistaken for a flood.

## [1.0.0-beta.1] - 2026-10-22

First public beta. The app was previously developed as an internal build; this
entry describes the public repository state, not a stable release. A
release-signed arm64 APK is attached to the public beta release. Device QA on a
physical Android device and an iOS build are still pending.

### Added

- Expo SDK 58 client for Android, iOS, and web.
- Authenticated Fastify bridge for the local OpenCode HTTP/SSE API.
- Session list with search, grouping, waiting state, create, rename, and
  delete.
- Streaming chat with reconnect, older-message paging, and a latest-message
  control.
- Inline question cards and a permission approval sheet with a destructive
  action confirmation.
- Image, camera, and document attachments with validation, retry, and
  authenticated downloads.
- Tool activity summaries and a diff viewer.
- Dark/light monochrome themes, English/Arabic/French UI, RTL layout, and
  mixed direction text.
- Optional Expo push notifications.
- Opt-in browser CORS with an exact `CORS_ORIGINS` allowlist, safe preflight
  handling, and tests for allowed and denied origins.
- Web SPA/PWA export with a manifest, install icons, and static-host fallbacks.
- Docker, Compose, systemd, and Caddy deployment recipes.
- Static project website with a monochrome landing page, a local link/fragment
  checker, and a GitHub Pages workflow.
- `eas.json`, a bridge/web release workflow with checksums, a release-signing
  workflow, and `docs/release.md`.
- A release-signed arm64 APK attached to the public beta release.
- Bridge tests for config, CORS, auth, uploads, WebSocket routing, mapping,
  state, and log redaction (84 tests).
- CI for both projects, Dependabot, issue templates, and a security policy.
- English and Arabic documentation, architecture notes, security model,
  development guide, release guide, and troubleshooting guide.

### Changed

- The app icon, adaptive icon, and splash mark now use a smaller centered
  lockup on the black field, closer to a wordmark-style launch screen.
- The web build is a single-page export with PWA metadata instead of a
  multi-page static export.

### Security

- Bearer-token authentication with constant-time comparison and failed-auth
  bans.
- Per-IP rate limiting and request caps.
- Workdir allowlist for sessions, uploads, and downloads.
- Upload type, extension, magic-byte, size, and filename validation.
- Log redaction for authorization headers, cookies, query tokens, and raw paths.
- Authentication before body parsing; `/health` is the only unauthenticated
  route.
- Release APK signing with a project keystore and certificate verification in
  CI.
- SecureStore on native, `sessionStorage` on web.
- Cleartext HTTP is allowed for local/Tailscale use. This is documented as a
  deliberate tradeoff; use Tailscale HTTPS when the network is not trusted.

### Known limitations

- Single shared token; no per-user authorization.
- No end-to-end encryption.
- No model or agent switching.
- No built-in Telegram bot; Telegram is an optional separate OpenCode client.
- Browser CORS is opt-in and must be configured with exact origins; a
  same-origin proxy is still preferred for public web deployments.
- Device QA on a physical Android device and an iOS build are still pending.
- Push notifications require an EAS project and a physical device.
- `npm audit` reports build-time advisories in the Expo CLI/Metro dependency
  chain. The bridge audit is clean. See the dependency audit status in
  `docs/security.md`.

### Notes

- OpenCode API compatibility was verified against `2.0.24`. Pin a known-good
  OpenCode version for production.
- The OpenCode name and logo belong to the upstream project. This project is
  unofficial and not endorsed by the OpenCode team.
