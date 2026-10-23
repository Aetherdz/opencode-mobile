# OpenCode Mobile — Implementation Brief and First Stable Release Plan

**Document type:** execution brief / handoff plan.
**Status:** implementation is in progress; stable-release gates are not met.
**End goal:** fix the installer, persistent bridge/OpenCode integration, mobile app behavior and UI; then ship the first non-beta release as `1.0.0` and update the website in the final release phase only.

> Do not edit `website/**` during the repair phases. The owner explicitly requested a website update only after all fixes have passed verification and the first stable release is ready.

---

## 1. Owner requirements — source of truth

Implement and verify all of the following:

1. Replace the incomplete/manual installation experience behind `curl -fsSL … | bash …` with a reliable setup that downloads, verifies, installs, and configures every required component.
2. After setup, running `opencode-mobile` should produce the public HTTPS link and pairing code/QR immediately and clearly.
3. Do not require the owner to manually start the bridge every time. Integrate with OpenCode through MCP and a managed background service so that starting the computer and OpenCode restores connectivity and loads existing OpenCode sessions without manually restarting the bridge.
4. Persist the selected dark/light theme across app exits and relaunches. The `system` option must continue to follow the OS appearance.
5. Fix screen and sheet transitions that currently look as if they drop from above. Sheets should enter smoothly from the bottom and exit in the corresponding direction.
6. Improve the session list, chat, thinking/streaming UI, attachment chooser, and model chooser using the supplied screenshots as interaction and visual references.
7. A question or permission requested by a command/tool running in the OpenCode terminal must reach the phone; answering on the phone must resolve the original request in that same terminal session.
8. Set message direction from the message text itself, not the app locale: Arabic is RTL even in an English UI; English is LTR even in an Arabic UI. This must remain correct during streaming and in Markdown.
9. After all repairs and release checks, publish the first official, non-beta stable version and update the website to identify it as the first official release.

## 2. Screenshot references

- `photo_1062`: recent chats/session list, navigation choices, selected row, and new-chat affordance.
- `photo_1063`: chat containing English and Arabic messages with independent direction, plus a bottom “Add to chat” sheet with file/photo/camera choices and secondary options.
- `photo_1064`: bottom-sheet model selector with model names, accurate descriptions/plan eligibility, selected state, effort, and more-model navigation.
- Treat supplied examples as layout references only. Do not copy third-party branding, names, icons, or proprietary assets.

## 3. Repository map and strict scope boundaries

### Primary source repository: `/home/zaikabdou1/opencode-mobile-repo`

- `app/`: the Expo Router / React Native mobile client that talks to the bridge. Current source values observed: `app/package.json` and `app/app.json` are `1.0.0-beta.3`; Android `versionCode` is `8`.
- `bridge/`: Fastify gateway used by the app. It talks to OpenCode over loopback HTTP/SSE and exposes authenticated HTTP/WebSocket APIs to the phone.
- `scripts/`: local setup/share helpers and tests.
- `deploy/`: documented systemd deployment, currently separate from the distribution installer.
- `.github/workflows/release.yml`: release packaging for bridge/web artifacts and checksums.
- `website/`: do not edit until the final stable-release phase.

### Distribution repository: `/home/zaikabdou1/opencode-mobile-dist`

- `install.sh`: POSIX installer and generated CLI (`setup`, `up`, `down`, `status`, `update`, `doctor`, `uninstall`, etc.).
- `install.ps1`: Windows PowerShell installer and corresponding launchers.
- `test/smoke.sh`: offline POSIX installer smoke tests.
- `README.md`: published installer and release-asset contract.

The currently published POSIX command is:

```sh
curl -fsSL https://raw.githubusercontent.com/Aetherdz/opencode-mobile-dist/main/install.sh | bash -s -- setup
```

The installer downloads the bridge and checks it against `SHA256SUMS`, but the current `opencode-mobile` flow is foreground/Quick-Tunnel oriented, and no MCP registration or persistent service integration was found in the inspected source. Confirm this baseline before implementation; do not assume the command above is already a complete installation.

### Explicitly out of scope

- `/home/zaikabdou1/opencode-apk` is a separate Kotlin app that connects directly through SSH/Cloud Shell. It is not the React Native app/bridge workflow in this brief. Do not modify it unless the owner later explicitly selects it.
- `/home/zaikabdou1/opencode-mobile` is a separate working copy, not the authoritative source checkout for this task. Its app version was observed as `1.1.3`, unlike the source repository’s `1.0.0-beta.3`. Do not mix its APKs or version values into this release.
- Do not overwrite the pre-existing modified APK under `opencode-apk/dist/`, any existing `.env`, signing credentials, or untracked files.
- Do not publish anything or change website files before the final release phase.

## 4. Verified architecture and relevant files

### Installer, daemon, bridge, and MCP boundary

- `opencode-mobile-dist/install.sh`: `parse_args`, `do_setup`, `install_bridge`, `quickstart`, `status`, `update`, and `uninstall_all` implement POSIX setup/CLI behavior.
- `opencode-mobile-dist/install.ps1`: `Initialize-Paths`, `Install-Bridge`, `Start-MobileSession`, `Invoke-Main`, and `Uninstall-All` implement Windows behavior.
- `opencode-mobile-repo/bridge/src/index.ts` and `bridge/src/server.ts`: Fastify process lifecycle and API/WebSocket wiring.
- `bridge/src/config.ts`: OpenCode service discovery, loopback checks, and allowed-workdir configuration.
- `bridge/src/adapters/OpenCodeAdapter.ts` and `bridge/src/opencode/client.ts`: OpenCode HTTP API and SSE communication.
- `bridge/src/state.ts`: transient runtime state is held in memory; this is separate from OpenCode’s own persistent sessions and bridge upload/data storage.
- **No MCP registration was found in the inspected source.** Local OpenCode is `v2.0.24`; official docs describe local MCP servers under `mcp` with `type: "local"`, a `command` array, `enabled`, and optional `environment`/`timeout`. A safe isolated `opencode mcp add --global` check wrote the CLI's current v2 shape as `mcp.servers.<name>`. Integrate using that observed CLI/schema behavior, preserving JSONC and unrelated settings; the check used only a temporary test HOME and did not alter the owner's OpenCode config.

### App boundary

- `app/src/app/_layout.tsx`: app bootstrap, hydration, providers, navigation, and `DirectionSync`.
- `app/src/state/settings.ts` and `app/src/theme/ThemeProvider.tsx`: persisted settings and theme resolution. Existing code already supports light/dark/system; diagnose the persistence/hydration regression before adding another store.
- `app/src/state/EventBridge.tsx` and `app/src/api/ws.ts`: bridge event lifecycle, WebSocket reconnect, app foreground/background handling, and cache updates.
- `app/src/app/sessions.tsx`: sessions/recent list.
- `app/src/app/chat/[id].tsx` and `app/src/state/chat.ts`: transcript, streaming, pending inputs, send/stop/retry, and event handling.
- `app/src/components/chat/MessageRow.tsx`: message, Markdown, attachments, reasoning, and streaming presentation.
- `app/src/components/chat/Composer.tsx`: input, send/stop, queue/steer, attachment actions, and draft handling.
- `app/src/components/markdown/Markdown.tsx` and `CodeBlock.tsx`: Markdown/code rendering.
- `app/src/components/chat/QuestionSheet.tsx`, `InlineQuestionCard.tsx`, and `ApprovalSheet.tsx`: pending question/permission UI.
- The bridge currently maps OpenCode `permission.asked` to `approval.request` and matching `form.created` events to `question.request`. HTTP routes exist for listing/replying/rejecting questions and replying to permissions. Verify a real terminal/TUI-originated request end to end; do not infer that an app-originated request proves this path works.

## 5. Execution phases (complete in order)

### Phase 0 — Baseline, ownership, and environment

1. Before editing, read any `AGENTS.md` in the repository and the owner-provided Expo instructions at `/home/zaikabdou1/opencode-mobile/app/AGENTS.md`. Before editing, record `git status` in both source and distribution repositories. Preserve all pre-existing dirty/untracked files; do not use blanket `git add` or destructive cleanup.
2. Confirm the authoritative app is `opencode-mobile-repo/app` and the Kotlin `opencode-apk` is excluded.
3. Record OpenCode, Node, Expo, bridge, installer, app, and Android build versions. Record the supported OS/architecture matrix.
4. Reproduce and record the current behaviors with screenshots/video and repeatable steps: theme across force-stop, mixed-language messages, streamed response, terminal question, attachment/model sheets, installer, background service, and session restoration.
5. Before writing any Expo/React Native code, read the Expo major in `app/package.json` (currently 58), fetch the matching docs at `https://docs.expo.dev/versions/v58.0.0/` and the index at `https://docs.expo.dev/llms.txt`, then follow links for the APIs actually used. Use `npx expo install` for Expo-compatible dependencies. Add no dependency without a concrete need.

**Exit gate:** baseline is reproducible, repositories and ownership are unambiguous, and the platform/version matrix is recorded.

### Phase 1 — Complete, verifiable one-command installation

1. Define the installer contract before changing scripts: commands, prerequisites, install paths, config ownership, upgrades, failures, rollback, and uninstall behavior. POSIX and Windows must have equivalent outcomes.
2. Replace direct execution of a mutable `main` script via `curl | bash` with a version-pinned bootstrap or independently verifiable bootstrap. Download release manifest/assets into a staging directory before executing/installing them.
3. List every component required for the requested experience and install it in one setup: supported runtime, bridge, CLI, daemon/service unit, MCP control server, and tunnel client or documented alternative. Download/install the APK only when explicitly requested.
4. Detect OS/architecture/runtime versions. Reject unsupported combinations and missing, unlisted, or incorrect checksums. Use HTTPS and SHA-256; use an independently signed manifest when signing infrastructure is available. A checksum file fetched from the same trust source is integrity checking, not an independent signature.
5. Make install/update transactional: download → verify → stage → preserve config/current release → atomic switch → health check. On any error, rollback without damaging the prior release, token, workdir restrictions, or user data.
6. Setup must be idempotent and preserve existing valid settings. Protect Linux config/data with `0600`/`0700`; restrict Windows ACLs. Never read, print, or copy secrets into logs.
7. After setup, `opencode-mobile` should ensure the managed service/tunnel is healthy and display the HTTPS link plus QR/deep link and pairing code. The tunnel must not die merely because the CLI terminal closes. Provide consistent `status`, `share`, `stop`, `doctor`, `update`, and `uninstall` behavior. Explain that a Cloudflare Quick Tunnel hostname can change after a tunnel restart.
8. Pairing security: never put the long-lived bearer token in a URL/query, logs, or MCP configuration. Prefer a short-lived, one-use, rate-limited pairing code exchanged over HTTPS for app credentials stored in SecureStore. If retaining the current token flow, show it only locally after explicit action and never log it.
9. Update installer help and documentation so they no longer instruct users to manually start the bridge every session.

**Tests:** extend `opencode-mobile-dist/test/smoke.sh` with fake-curl/offline coverage: clean install, repeated setup, missing/bad checksum, interrupted download, update rollback, preservation of config/token, link/status/doctor behavior, and uninstall with/without purge. Add equivalent PowerShell tests or document a Windows VM run. Never test by executing a downloaded installer against an external machine.

### Phase 2 — Managed bridge service and OpenCode MCP integration

1. Keep the network-facing bridge (Fastify HTTP/WebSocket) separate from the MCP control server (stdio speaking MCP to OpenCode). MCP protocol messages must be the only content on stdout; logs go to stderr or a protected log file.
2. Verify the official MCP configuration schema, tool permissions, and process lifecycle for the installed OpenCode version. Do not expose the MCP stdio endpoint or OpenCode’s local API to the public tunnel.
3. Setup adds one idempotent MCP entry to the correct user OpenCode config. Preserve unrelated JSON/JSONC settings. Back up before editing; update/remove only the entry owned by OpenCode Mobile during uninstall.
4. Install an OS-native user service: systemd user unit on Linux, LaunchAgent on macOS, and a supported Windows logon task/service. Start automatically after login; restart after failure with bounded backoff; offer explicit status/stop/uninstall.
5. Do not require `opencode-mobile up` per session. After initial setup, starting OpenCode loads MCP and the service is already running or starts automatically. If OpenCode starts after the bridge, the bridge must rediscover/reconnect without a manual restart.
6. On OpenCode startup/reconnect, discover the service metadata, confirm the upstream URL is loopback, check health, then query current sessions/history from OpenCode. OpenCode remains the source of truth for session content; do not create a competing transcript database.
7. MCP tools should be minimal (for example: status/share/reconnect). The network bridge and tunnel lifecycle must not depend on the lifetime of an individual OpenCode TUI process; use a single-instance lock and permission-restricted local IPC between MCP controller and daemon.
8. The service starts/reconnects the Quick Tunnel and updates its current URL in status. If a stable hostname is required, document that a named tunnel and Cloudflare credentials are optional; do not claim Quick Tunnel URLs are stable.
9. Keep MCP config, bridge config, and secrets separate. The OpenCode config must not contain the bearer token or tunnel secret.

**Exit gate:** after one-time setup, reboot/login and start OpenCode. The bridge is healthy, the tunnel/link is available, and current sessions appear on the phone without manually starting or restarting the bridge. Test Linux and Windows; test macOS if advertised as supported. Document the one-time OpenCode reload needed to ingest MCP config, if required by OpenCode.

### Phase 3 — Terminal-originated questions and permissions

1. Trace a real request created by OpenCode TUI through `/api/event`. Record event name, fields, session ID, and lifecycle timestamps, without logging prompt secrets or user content.
2. Verify terminal-originated `permission.asked` and `form.created` events flow through `bridge/src/ws.ts`, are recorded in `RuntimeState`, and broadcast as `approval.request` or `question.request` to the correct session.
3. If terminal questions use another OpenCode event type, add an explicit typed mapping in adapter/types/state. Do not turn arbitrary events into questions or discard schema/answer options.
4. Exercise existing `GET/POST /permissions` and `GET/POST /questions` routes. Validate the reply/reject payload against the original request/session; prevent duplicate/replayed answers and clean up expired/resolved state.
5. In the app, verify `EventBridge` and `app/src/state/chat.ts` show pending inputs while foregrounded and after background/resume. Send a push notification when permitted if the relevant screen is not open; tapping it should return to the correct session/request.
6. Confirm the phone’s answer resolves the original TUI interaction and the resolved state reaches both clients. Test reject/cancel/timeout/reconnect and concurrent sessions; no cross-session disclosure.

**Exit gate:** an automated/integration test starts a permission or question in an OpenCode terminal session, observes it on the phone, submits/rejects it on the phone, and observes resolution in the same terminal/session. Repeat with the app backgrounded and resumed.

### Phase 4 — Theme persistence and app restoration

1. Reproduce with dark selected, normal exit, force-stop, device restart, relaunch, and deep-link/push launch. Capture persisted preference and resolved theme before/after hydration.
2. Inspect hydration order in `_layout.tsx`, `settings.ts`, and `ThemeProvider.tsx`. Do not render the light default before storage is read; do not let defaults or remote state overwrite the user’s choice.
3. Keep one persisted `dark | light | system` preference. Migrate absent/invalid values safely. OS appearance changes affect the app only when the saved choice is `system`.
4. Apply the resolved theme to status/navigation bars and native/system UI after hydration, for each supported platform.

**Tests:** preference serialization/migration, provider remount/relaunch, light↔dark, system-following behavior, force-stop persistence, and no visible theme flash/reset when navigating or returning from background.

### Phase 5 — Chat typography, thinking/streaming, and per-message bidi

1. In `MessageRow.tsx`, determine direction for each text paragraph/message independently of `DirectionSync` and app locale. Use first-strong bidi classification: Arabic/Hebrew strong text → RTL; Latin strong text → LTR; text with no strong characters falls back to UI locale.
2. Keep bubble placement (role/layout) separate from text direction. A user/assistant bubble may be placed by role while its text renders in its own direction.
3. Markdown must preserve block boundaries. Render each text paragraph with the detected direction; keep code, file names, URLs, IDs, shell commands, and technical identifiers LTR and bidi-isolated. Never reverse characters, punctuation, or code order.
4. For streamed drafts, set direction once a strong character appears and keep it stable for that message; do not flip on every delta. Test strings beginning with punctuation/numbers before Arabic, and Arabic with embedded Latin/URLs.
5. Preserve the distinction between thinking/reasoning, tool/activity progress, and answer text. Improve their typography and states against the references. Keep private/internal reasoning hidden unless the existing product contract explicitly exposes it. Maintain stop/retry behavior and auto-scroll only when the user is already near the bottom.
6. Improve message, thinking, status, attachment, and error readability without coupling message language to UI language.

**Exit gate:** English UI renders Arabic messages RTL and English messages LTR; Arabic UI does the inverse. Verify before/during/after streaming, mixed Markdown, code and URLs, and no clipping/overflow.

### Phase 6 — Sessions, bottom sheets, and motion polish

1. Sessions/Recents: refine `app/src/app/sessions.tsx` to present readable recent rows, selected state, navigation choices, and new-chat action, following `photo_1062`. Support English/Arabic and RTL without misplacing icons or actions.
2. Add-to-chat: refine `Composer.tsx` and attachment UI to open a bottom sheet with a handle, restrained scrim, Files/Photos/Camera actions, and secondary options only where the feature is actually implemented and authorized. Never show fake/unavailable buttons.
3. Model selection: provide a bottom sheet with model name, accurate description and eligibility from real API data, selected check state, effort control, and more-model navigation, following `photo_1064`. Do not invent plan/feature claims.
4. Standardize Question/Approval/Model/Attachment sheets: enter from the bottom and exit downward, brief predictable duration, low-overshoot spring, dimmed scrim, sensible top corners/handle, and no top-down “fall” animation. Respect Reduce Motion.
5. Test safe areas, small screens, landscape, keyboard/IME, Android back, drag-to-dismiss, and focus/accessibility. Keep all controls reachable and do not cover the composer/send action.
6. Do not add a motion dependency until the current Reanimated `4.7.1`/Expo SDK `58` APIs have been checked in the versioned docs. For any native dependency, follow `app/AGENTS.md` and rebuild the development client.

**Tests:** screenshots and interaction runs on Android/iOS phone and tablet sizes, repeated open/close, back and drag gestures, Reduce Motion, RTL, keyboard-visible layouts, and accessibility focus. Verify sheets never animate in from the top.

### Phase 7 — Integration, regression, and security verification

- App: `npx tsc --noEmit`, `npm run lint` / `npx expo lint`, `npx expo-doctor`, plus new unit/component/e2e tests.
- Bridge: `npm test`, `npm run build`, and tests for terminal event mapping, question/permission state, reconnect, and session isolation.
- Distribution: offline POSIX smoke tests plus PowerShell tests/Windows VM results.
- End-to-end: clean install, upgrade from beta, setup, OpenCode launch, session restore, link creation, Arabic/English streams, terminal question/reply, background/resume, service recovery, second-device pairing, and uninstall preserving data by default.
- Security: bridge remains loopback-bound; no secret in URL/query/MCP config/console; pairing entropy/expiry/rate limit; HTTPS tunnel; CORS and short-lived WS tickets; allowed-workdir isolation; `.env` permissions/Windows ACLs; no unverified curl execution; atomic update/rollback.
- Test on a physical Android device: install/upgrade, force-stop/reopen, theme persistence, question notification, keyboard, sheets, RTL/LTR, network interruption/recovery. A web preview is not a substitute for native testing.

**Do not begin a stable release** if terminal questions, preference persistence, per-message direction, installer verification, or service recovery has a known failure.

### Phase 8 — First official stable release: `1.0.0`

1. Inventory all version fields, tags, and release assets across source, app, bridge, and distribution before changing version numbers.
2. Target `1.0.0` with no `-beta` suffix, as requested. Keep Android `versionCode` strictly greater than the observed current value `8` (initial candidate `9`, subject to checking every published build). Increase iOS `buildNumber` if an iOS binary is included.
3. Signing: historical build records say APKs used a debug certificate. Do not call a debug-signed APK an official stable release. Configure protected release signing/EAS credentials outside Git and verify that the signing identity permits upgrading the existing package ID.
4. Build the release artifact through the project’s approved CI/EAS flow; install and test it on a physical device. Verify `apksigner`, manifest, package/version, ABI, checksum, and download. State exactly which platforms/ABIs are supported; do not imply an iOS release without a built and tested binary.
5. Publish source/bridge/distribution assets coherently: tag and assets such as `opencode-mobile-bridge-<version>.(tar.gz|zip)`, APK, and `SHA256SUMS`. Fail the release if any required artifact is absent. Include changelog and migration notes from `1.0.0-beta.3`.
6. Make the installer select stable by default. Keep a beta channel only if intentionally supported. Verify asset names/checksums for POSIX and Windows, including install and update.
7. **Only after all previous steps pass**, update `website/` in EN/AR/FR/ES: show `1.0.0` as the first official release, remove obsolete beta presentation from current download copy/metadata, and link only verified artifacts. Do not alter unrelated website instructions or embed unverified checksums.
8. Run `npm run check:site`, interaction/accessibility checks, and the visual matrix across all four languages, themes, and widths. Verify links, release assets, and checksums.
9. Publish GitHub Release, distribution artifacts, and website in a documented order; verify public URLs, installation, signatures, and checksum after deployment. Send the owner one concise download/update message.

## 6. Mandatory acceptance checklist

- [ ] One setup command installs and verifies every required component; no manual follow-up downloads.
- [ ] `opencode-mobile` prints a working HTTPS link and pairing QR/code; bearer credentials are not exposed in URL/query/logs.
- [ ] After setup, login/reboot plus OpenCode startup recovers the service and existing sessions without manually starting/restarting the bridge.
- [ ] MCP config matches the actual OpenCode version, is idempotent/removable, and the network service is not tied to one TUI process.
- [ ] Dark/light choice survives force-stop and relaunch; system mode follows the OS with no flash.
- [ ] A terminal-originated question/permission reaches the phone and its reply resolves the original session.
- [ ] Message language controls RTL/LTR independent of app language, including streaming/Markdown; code/URLs remain correct.
- [ ] Sheets enter smoothly from below and match the references functionally; no falling animation from above.
- [ ] Supported installer platforms pass smoke/upgrade tests; Android release upgrade is verified on-device.
- [ ] First stable artifact is `1.0.0`, release-signed, checksum-verified, and has no beta labeling.
- [ ] Website remains untouched until release gate, then all four languages and public download links are verified.

## 7. Handoff instructions for the next implementation session

1. Read this file, repository `AGENTS.md` files, and the owner-provided Expo instructions at `/home/zaikabdou1/opencode-mobile/app/AGENTS.md` before editing. That instruction file may not be present in the authoritative source checkout; follow the supplied instructions regardless. Capture `git status` for every repository and preserve existing dirty/untracked files.
2. Treat `opencode-mobile-repo` as app/bridge source and `opencode-mobile-dist` as installer source. Do not work in the separate Kotlin APK repo or the `/home/zaikabdou1/opencode-mobile` copy.
3. Execute phases 0–7 in order, making focused commits and recording tests/evidence after each phase. Update this plan if repository facts differ; do not silently skip a requirement.
4. Keep `website/**` unchanged until Phase 8. Do not publish the official release until every acceptance item passes.
5. Before using Expo/React Native APIs, consult the matching SDK 58 documentation and `llms.txt`; use SDK-compatible installs.
6. Never print `bridge/.env`, pairing credentials, or signing secrets in logs, chat, or this plan.

## 8. Current completion state

Progress snapshot (2026-10-23):

- Baseline ownership and version checks have started. Local OpenCode is `v2.0.24`; beta.4 is being prepared with Android `versionCode` 9. Physical Android verification is unavailable in the current environment (`adb` is not installed); beta.4 is intended for owner device testing before any stable release.
- App changes currently in the worktree cover theme normalization/hydration, first-strong per-message direction, visible escaping of directional marks and embedding/override/isolate controls in rendered/accessibility text, LTR isolation for technical runs, SDK 58 config/dependency alignment, a corrected sheet exit-animation lifecycle, and clearer selected/new-chat affordances in the session list. Focused app tests (4/4), TypeScript, lint, web export, and `expo-doctor` (20/20) pass. Device-level appearance/animation acceptance remains unverified.
- Bridge tests now pass (98/98), including safe enabled-model mapping, `/models` response shaping, selected-model forwarding, and rejection of malformed/unavailable model choices with an error returned to the originating optimistic message. The bridge build passes. A read-only MCP review identified and fixed the unsupported-version fallback and added legacy JSON-RPC batch handling. Direct stdio smoke verified JSON-RPC-only stdout, and an isolated OpenCode CLI config test verified MCP registration is repeatable, preserves unrelated entries and contains no credentials. This is not an OpenCode-hosted MCP handshake or a real TUI-to-phone E2E test. The offline POSIX installer smoke test rejects missing/mismatched SHA-256 entries, simulates a partial archive download failure, verifies rollback/config preservation, checks MCP registration contains no secrets, and now exercises fake-systemctl service install/status/down/uninstall. `bash -n`, `git diff --check`, and the POSIX smoke test pass. The systemd user service runs the bridge but does not manage a persistent Cloudflare tunnel; Quick Tunnel still requires foreground `opencode-mobile` and user consent, so automatic public-link recovery is not complete. PowerShell runtime and real Windows remain unverified.
- The model chooser remains backed by the authenticated enabled-model catalog, persists the selected model locally, and sends/validates it end-to-end. It has been moved from the header into the bottom composer toolbar, beside the attachment control. Markdown paragraphs, lists and quotes now follow each message's first strong character instead of the app locale. Playwright verified the model control placement and mixed-direction replies on Expo Web; native Android/iOS layout and RTL remain unverified. The README gallery has three original Expo Web captures with synthetic data. Linux uninstall removes only the owned OpenCode Mobile MCP entry with a backup; Windows MCP cleanup is not implemented, and the Windows service lifecycle remains incomplete. `install.ps1` now documents this limitation and manual MCP cleanup workaround. Bridge protocol tests and stdio smoke cover initialization, tools/list, status calls, malformed choices and clean stdout; the actual OpenCode service lists only its existing servers, and a separate live MCP handshake remains to be confirmed after reload. The four high app `node-forge` advisories remain unresolved with no compatible npm fix; they are tracked in `docs/security.md`. Owner device testing, terminal-question E2E, Windows runtime tests, and future stable release gates remain outstanding. Website files stay unchanged for this beta. No stable `1.0.0` artifact has been built or published.
- The completion checklist below remains the release gate; do not infer completion from these partial checks.
- Beta.4 release preparation: app/root manifests are bumped to `1.0.0-beta.4`, Android `versionCode` to 9 and iOS `buildNumber` to 4. The release workflow marks hyphenated versions prerelease; the signed APK workflow can attach APK plus updated checksums to the existing release. The distribution installers now select the newest published release including prereleases (the old `/releases/latest` endpoint skipped beta tags). Root checks, 98 bridge tests, 4 app tests, Expo Doctor 20/20, web export, site-link check, Linux installer smoke, and local bundle checksum verification pass. App audit still reports 4 high `node-forge` findings without a compatible npm fix. The OpenCode CLI writes the expected MCP config and the built server's stdio protocol smoke passes; the already-running OpenCode host has not reloaded it, so live connection remains unconfirmed. beta.4 publication is a test release only; wait for owner device testing before considering stable. Windows runtime/service/MCP cleanup remains explicitly unfinished. Do not update the website for this beta.
