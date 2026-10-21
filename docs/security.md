# Security

## Scope

This document covers the bridge and the Expo app in this repository. It does
not cover the OpenCode service, the host operating system, Tailscale, Expo's
push service, or any model provider. Those systems have their own security
models.

The bridge is a remote control for a coding agent. It is not a sandbox. If an
attacker can send authenticated prompts, they can ask OpenCode to read, write,
or execute things that OpenCode is allowed to touch.

## Threat model

### Assets

- The bridge bearer token.
- The OpenCode password and the local OpenCode API.
- Source code and files inside `ALLOWED_WORKDIRS`.
- Uploaded files and the `files.json` registry.
- Session content, prompts, diffs, and tool output.
- Expo push tokens in `push.json`.

### Actors

| Actor | Capability |
| --- | --- |
| Network attacker on the same Wi-Fi or tailnet | Can reach the bridge if the host is exposed. Cannot authenticate without the token. |
| Attacker with the token | Full bridge API access, including prompts, uploads, approvals, and session interruption. |
| Malicious file uploader | Can submit files to an allowed workdir. Constrained by type, size, name, and path checks. |
| Malicious web page | Can attempt cross-origin requests. The bridge does not add CORS headers, so a browser blocks reads unless a proxy is used. |
| Local unprivileged user on the host | Can read files if the OS permissions allow it. The bridge does not add OS-level isolation. |

### Trust boundaries

- Phone/browser to bridge: untrusted network.
- Bridge to OpenCode: loopback. The bridge rejects non-loopback OpenCode URLs.
- Bridge to filesystem: only `ALLOWED_WORKDIRS`.
- Bridge to Expo push: third-party network egress.

## Controls

### Authentication

- All REST routes except `GET /health` require
  `Authorization: Bearer <AUTH_TOKEN>`.
- The WebSocket requires a valid token. Because React Native WebSocket
  implementations cannot reliably attach headers on every platform, `/ws`
  also accepts `?token=`.
- Token comparison hashes both sides and uses `crypto.timingSafeEqual`.
- Repeated failures from one IP trigger a temporary ban. A correct token always
  wins, so a stale client cannot lock out the owner by burning attempts for the
  same IP.
- The bridge does not implement user accounts, sessions, or roles. There is one
  shared token.

### Network exposure

- `HOST` defaults to `127.0.0.1`. Keep it there.
- `OPENCODE_URL` must resolve to `127.0.0.1`, `::1`, or `localhost`.
- The recommended remote path is Tailscale: `tailscale serve --bg
  http://127.0.0.1:8787`.
- The bridge does not add CORS headers. A browser-based build needs a
  same-origin proxy or a future explicit CORS option. Do not solve this by
  disabling browser security.
- `trustProxy` is off. Do not put the bridge behind a proxy that rewrites
  client IPs unless you understand the effect on bans and rate limits.

### Authorization and workdirs

- Session creation resolves the requested directory with `realpath` and checks
  it is inside `ALLOWED_WORKDIRS`.
- `ALLOWED_WORKDIRS` cannot be the filesystem root.
- Uploads are written inside the session workdir, not in a shared temp
  directory.
- Downloads are checked against the file registry and served only by file ID.
- Existing OpenCode sessions outside `ALLOWED_WORKDIRS` may still be visible
  through the OpenCode API. The bridge's workdir check is not a complete
  OpenCode ACL.

### Uploads

- Per-file and total size limits.
- File-count limit.
- MIME type and extension allowlist.
- Magic-byte checks for binary formats.
- Text validity checks for code and text files.
- Filename normalization and a generated storage name.
- Files written with mode `0600`; directories with mode `0700`.
- Detected MIME type is used for downloads, not the client-declared type.
- `X-Content-Type-Options: nosniff` and attachment disposition on downloads.

Uploads are still attacker-controlled content. Do not open untrusted uploads
with a privileged viewer on the host.

### Rate limiting and bans

- Per-IP request rate limit.
- Failed-auth ban after `BAN_AFTER` attempts for `BAN_MINUTES`.
- WebSocket payload cap of 1 MB.
- Upload request cap and per-request field cap.
- Subscription and room caps in the WebSocket hub.

### Logging and redaction

- Pino redacts authorization headers, cookies, `x-auth-token`, and query
  tokens.
- The 404 handler does not log the raw URL, so a stray `?token=` cannot leak
  through an unknown path.
- Request logging is disabled; route handlers log structured errors.
- Bridge logs can still contain session IDs, file names, and error text. Treat
  them as sensitive.

### App storage

- Native: `expo-secure-store` for the bridge URL and token.
- Web: `sessionStorage`, so the token does not persist across a browser
  restart.
- The token is not placed in a URL except for the WebSocket query, which is a
  documented tradeoff.
- The app does not log the token.

### Transport

- Native builds allow cleartext HTTP for local and Tailscale use. This is a
  deliberate tradeoff for a self-hosted tool.
- Prefer the HTTPS URL from `tailscale serve` when the phone is not on the same
  trusted network.
- The bridge itself speaks plain HTTP. TLS is provided by Tailscale, a reverse
  proxy, or a tunnel.

## Known gaps

These are known and accepted for the beta. They are not vulnerabilities by
themselves, but they matter when choosing an exposure model.

1. **One shared token, no per-user authorization.** A token holder can do
   everything the bridge allows.
2. **No end-to-end encryption.** The bridge sees prompts, files, and session
   content in plaintext.
3. **Cleartext HTTP is allowed in native builds.** A network attacker on the
   same untrusted network could observe traffic if TLS is not used.
4. **WebSocket query token.** It can appear in proxy, tunnel, or browser
   history logs.
5. **OpenCode sessions are not fully scoped by workdir.** The bridge can list
   sessions that OpenCode already knows about.
6. **No CORS support.** The web build is a UI preview unless served same-origin
   or behind a proxy.
7. **No CSRF concern in the classic sense, but a browser page can still send
   requests.** Without CORS it cannot read responses; it can still attempt
   state-changing requests if it knows the token. Treat the token as a secret.
8. **Push is third-party.** Expo receives the push token and notification
   payload. Payloads contain IDs and generic text, not message bodies.
9. **No automated dependency or container scanning in this repository yet.**
   Dependabot and CI are configured, but they are not a complete supply-chain
   program.
10. **Debug APKs are not release artifacts.** Do not distribute a debug-signed
    APK as a production build.

## Dependency audit status

As of 2026-10-21:

- `bridge`: `npm audit --omit=dev` reports 0 vulnerabilities.
- `app`: `npm audit --omit=dev` reports 28 advisories, 19 high, in the
  Expo CLI / Metro / `node-forge` / `uuid` dependency chains. The reported
  issues are build-time or CLI paths, not app runtime code. npm's proposed fix
  is a breaking downgrade to Expo 44, which is not compatible with this app.
  The advisories are tracked upstream and must be re-checked before a release.

Do not run `npm audit fix --force` on the app. It will replace the Expo SDK with
an old, incompatible version. Review each advisory and upgrade through a tested
Expo SDK release instead.

## Deployment checklist

- [ ] `AUTH_TOKEN` is at least 32 random characters and unique to this bridge.
- [ ] `HOST=127.0.0.1`.
- [ ] `ALLOWED_WORKDIRS` lists only the project roots you intend to expose.
- [ ] `DATA_DIR` is on a private path and excluded from backups you do not
      control.
- [ ] The bridge is reached through Tailscale or an SSH tunnel, not a public
      port.
- [ ] TLS is terminated by Tailscale or a reverse proxy if the network is not
      trusted.
- [ ] `PUSH_ENABLED=0` if you do not want Expo push registration.
- [ ] Logs are rotated and access-controlled.
- [ ] `.env`, `data/`, `.opencode-uploads/`, and APKs are not committed.
- [ ] The token is rotated after a demo, screenshot, screen share, or suspected
      exposure.

## Token rotation

1. Generate a new token: `openssl rand -hex 32`.
2. Stop the bridge.
3. Update `AUTH_TOKEN` in `bridge/.env`.
4. Start the bridge.
5. Update the token in the app; reconnect.
6. Revoke the old token everywhere it was stored.

Rotating the token does not revoke OpenCode sessions or change the OpenCode
password. Rotate those separately if they were exposed.

## Reporting a vulnerability

Do not open a public issue for a security problem. Use the repository's private
vulnerability reporting flow described in [SECURITY.md](../SECURITY.md). Include
the bridge version from `GET /config`, the OpenCode version, reproduction steps,
and the impact. Do not include real tokens, private source code, or personal
data.

## What this project does not promise

This is a beta self-hosted tool. It is not a hardened multi-tenant service. It
does not protect you from a compromised host, a malicious OpenCode plugin, a
malicious model, or an attacker who already has your token. Review the code and
run it on a machine you control.
