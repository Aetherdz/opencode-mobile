# Roadmap

This roadmap turns the beta source tree into a complete, self-hosted product:
a mobile and web client, a documented bridge, reproducible releases, one-command
installation, deployment recipes, and a public website.

The order is deliberate. Each milestone must be usable on its own; later work
must not require rewriting earlier work.

## Product definition

OpenCode Mobile is an unofficial client for a local OpenCode service:

- **App**: Expo / React Native client for Android, iOS, and web.
- **Bridge**: authenticated local HTTP and WebSocket gateway that adapts the
  OpenCode API for the app.
- **Deployment**: native install, Docker, systemd, and reverse-proxy recipes.
- **Distribution**: a separate repository with installers, checksums, and
  release notes.
- **Website**: a static landing page, documentation entry points, and download
  links.

The project stays self-hosted. There is no hosted relay, no account system, and
no telemetry.

## Milestones

### M1 — Web-ready beta

Goal: the bridge can serve the web client safely from an allowed origin, and the
web build is a first-class target.

- [x] Add an origin allowlist to the bridge (`CORS_ORIGINS`), disabled by default.
- [x] Handle preflight requests before authentication; never reflect arbitrary
      origins.
- [x] Add tests for allowed, disallowed, and missing origins.
- [x] Document the web workflow and the same-origin proxy recommendation.
- [x] Add a web app manifest and document static hosting.
- [x] Keep `npm run check` green (84 bridge tests at the time of writing).

Acceptance: a browser served from an allowlisted origin can call the bridge with
a bearer token; any other origin is rejected by the browser because no CORS
headers are returned.

### M2 — Release-grade builds

Goal: a signed Android APK and a reproducible release bundle can be produced
from CI without exposing signing material.

- [x] Set the beta package ID, display name, repository links, and license holder.
- [ ] Replace the icon and settle the trademark position before a stable release.
- [x] Add `eas.json` and document local and EAS builds.
- [x] Add a release workflow for bridge/web archives and checksums, plus a
      separate release-signing workflow for the Android APK.
- [x] Publish bridge and web bundles with SHA-256 checksums.
- [x] Publish a release-signed APK.
- [ ] Complete the physical-device QA pass and produce an iOS build.
- [x] Add release notes and versioning rules in `docs/release.md`.
- [ ] Verify the release from a fresh clone.

Acceptance: a tagged release contains a signed APK, a web archive, a bridge
archive, and checksums; the workflow never prints secrets.

### M3 — Deploy anywhere

Goal: the bridge can run on a laptop, a home server, or a small VPS with clear
security boundaries.

- [x] Add a non-root Docker image and Compose file.
- [x] Document Linux host networking, macOS/Windows alternatives, and the
      loopback-only OpenCode requirement.
- [x] Add a systemd unit with hardening options.
- [x] Add Caddy and Tailscale recipes for TLS and private access.
- [x] Add a deployment checklist and backup guidance for `data/`.
- [x] Document log redaction and token rotation.

Acceptance: the documented Linux path starts the bridge, passes a health check,
survives a reboot, and exposes no port beyond the intended interface.

### M4 — One-command distribution

Goal: a new user can install, update, diagnose, and remove the product from a
terminal.

- [x] Create and publish the separate `opencode-mobile-dist` repository.
- [x] Write a POSIX `install.sh` with green success, red error, and yellow
      warning output; disable color when not a TTY or when `NO_COLOR` is set.
- [x] Write a PowerShell installer for Windows.
- [x] Implement `install`, `update`, `doctor`, `uninstall`, and `--dry-run`.
- [x] Verify SHA-256 checksums before executing anything.
- [x] Never print tokens; generate them locally with restrictive permissions.
- [x] Add installer tests (offline shell smoke test and PowerShell parse/dry-run).

Acceptance: a clean Linux machine and a clean Windows machine can install the
documented components, run `doctor`, and uninstall without leftovers.

### M5 — Public website

Goal: a fast, accessible, black-and-white site that explains the product and
points to verified downloads.

- [x] Build a static site (no runtime framework required).
- [x] Include features, security model, a CSS product mockup, download, docs, and FAQ.
- [x] Add the unofficial-project disclaimer and trademark notice.
- [x] Add accessible navigation, focus states, reduced-motion support, and an
      Arabic README entry point.
- [x] Deploy to GitHub Pages.
- [x] Add a local link/fragment checker; analytics decision: no analytics.
- [x] Add a release-signed APK download.

Acceptance: the site works without JavaScript for core content, has no external
trackers, and every download link resolves to a release artifact with checksums.

### M6 — Post-beta capabilities

Goal: close the gaps that are useful but not required for the first public beta.

- [ ] Model and agent switching, if the OpenCode API exposes stable endpoints.
- [ ] Optional desktop wrapper decision (PWA first; Tauri or Electron only with
      a clear maintenance budget).
- [ ] iOS build and TestFlight notes.
- [ ] Push notification hardening and delivery diagnostics.
- [ ] Accessibility audit and localization pass.
- [ ] Performance budget for long sessions and large attachments.

Acceptance: each capability has a design note, tests, and a rollback path.

## Workstreams

| Workstream | Owns | Primary paths |
| --- | --- | --- |
| App | Screens, state, i18n, accessibility | `app/` |
| Bridge | API adaptation, auth, uploads, WebSocket | `bridge/` |
| Release | Versions, signing, CI, artifacts | `.github/`, `scripts/`, `eas.json` |
| Deploy | Docker, systemd, proxy, operations | `deploy/`, `docs/` |
| Distribution | Installers, checksums, update path | separate `opencode-mobile-dist` |
| Website | Landing page, docs entry, downloads | `website/` |
| Security | Threat model, dependency review, disclosure | `SECURITY.md`, `docs/security.md` |

## Decisions

| Decision | Current choice | Status |
| --- | --- | --- |
| License | MIT | Done |
| Version | `1.0.0-beta.2`, Android `versionCode 7` | Provisional |
| Package ID | `com.aetherdz.opencodemobile` | Set for beta |
| App icon | Official OpenCode logo | Trademark risk; replace before stable |
| Repository layout | Source repo plus separate distribution repo | Done |
| Web access | Explicit origin allowlist, no wildcard | In progress |
| Desktop | PWA first; wrapper later | Deferred |
| Model switching | Only with stable upstream endpoints | Deferred |
| Hosting | GitHub Pages plus GitHub Releases | Live for beta |

## Risks

- **No local Android SDK or device.** APK verification depends on EAS or CI.
- **Signing material.** A lost keystore blocks updates; it must be backed up by
  the owner, never committed.
- **Upstream API drift.** OpenCode is evolving; pin the tested version and keep
  the adapter isolated.
- **Trademark.** The current name and icon imply affiliation. Keep the
  disclaimer visible and replace the icon before a stable release.
- **Browser threat model.** A bearer token in web storage is exposed to XSS;
  prefer short-lived sessions and a same-origin proxy for public deployments.
- **Dependency advisories.** The app's build toolchain carries advisories that
  cannot be fixed without an Expo upgrade; document and re-check each release.

## Immediate queue

1. Implement `CORS_ORIGINS` with tests and documentation (M1).
2. Add the web manifest and static hosting notes (M1).
3. Add the Docker and systemd deployment recipes (M3).
4. Create the distribution repository and installer skeleton (M4).
5. Build the static website (M5).
6. Prepare the release workflow and EAS configuration (M2).

## Definition of done for the public beta

- Fresh clone passes `npm ci`, `npm run check`, `npm run build:bridge`, and a
  web export.
- No secrets, personal paths, or private screenshots are tracked.
- The README states the beta limitations and the unofficial status.
- A signed APK and checksums exist for the tagged release.
- The installer and deployment docs are tested on at least one clean Linux
  environment.
- The owner explicitly approves the push and the release.
