# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/). This is a
pre-1.0 beta; minor versions may change the bridge protocol.

## [1.0.0-beta.1] - Unreleased

First public beta. The app was previously developed as an internal build; this
entry describes the public repository state, not a stable release.

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
- Dark/light monochrome themes, Arabic/English UI, RTL layout, and mixed
  direction text.
- Optional Expo push notifications.
- Opt-in browser CORS with an exact `CORS_ORIGINS` allowlist, safe preflight
  handling, and tests for allowed and denied origins.
- Web SPA/PWA export with a manifest, install icons, and static-host fallbacks.
- Docker, Compose, systemd, and Caddy deployment recipes.
- Static project website with a monochrome landing page, a local link/fragment
  checker, and a GitHub Pages workflow.
- `eas.json`, a bridge/web release workflow with checksums, an installable
  debug APK workflow, and `docs/release.md`.
- Bridge tests for config, CORS, auth, uploads, WebSocket routing, mapping, and
  state.
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
- Log redaction for authorization headers, cookies, and query tokens.
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
- Device QA on Android and iOS is still pending.
- The repository does not produce a release-signed APK yet.
- Push notifications require an EAS project and a physical device.
- `npm audit` reports build-time advisories in the Expo CLI/Metro dependency
  chain. The bridge audit is clean. See the dependency audit status in
  `docs/security.md`.

### Notes

- OpenCode API compatibility was verified against `2.0.24`. Pin a known-good
  OpenCode version for production.
- The OpenCode name and logo belong to the upstream project. This project is
  unofficial and not endorsed by the OpenCode team.
