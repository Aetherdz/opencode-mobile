# Troubleshooting

Start with the health check and the bridge log. Most problems are one of:
wrong URL, wrong token, bridge not running, or OpenCode not reachable.

```bash
curl -sS http://127.0.0.1:8787/health
# {"ok":true}

curl -sS -H "Authorization: Bearer $AUTH_TOKEN" http://127.0.0.1:8787/config
```

## The app cannot reach the bridge

**Symptoms:** "Could not reach the bridge", a timeout, or a connection reset.

**Checks:**

1. Is the bridge running?
   ```bash
   curl http://127.0.0.1:8787/health
   ```
2. Does `HOST` bind to an address the phone can reach? The default
   `127.0.0.1` only accepts local connections. Keep it loopback and use
   Tailscale:
   ```bash
   tailscale serve --bg http://127.0.0.1:8787
   tailscale status
   ```
3. Is the phone on the same tailnet? Open the Tailscale app and check the
   machine is online.
4. Is the URL correct? Use the `https://<machine>.<tailnet>.ts.net` address,
   not `http://127.0.0.1:8787`, from the phone.
5. Is a firewall blocking the port? Tailscale Serve avoids opening a LAN port.
6. On an Android emulator, use `adb reverse tcp:8787 tcp:8787` and then
   `http://127.0.0.1:8787`, or use `http://10.0.2.2:8787` if the bridge is
   reachable on that interface.

Do not bind `0.0.0.0` just to make the phone connect. That exposes the bridge to
every interface on the host.

## `401 unauthorized`

The app token does not match `AUTH_TOKEN`.

- Re-copy the token; do not add quotes or trailing spaces in the app.
- Confirm the bridge loaded the value you think it did:
  ```bash
  # Do not print the token. Check that the variable exists and its length.
  grep -c '^AUTH_TOKEN=' bridge/.env
  ```
- If you changed `.env`, restart the bridge.
- The token must be at least 32 characters.

## `429 banned`

Too many failed authentication attempts from the same IP. Wait for
`BAN_MINUTES`, then use the correct token. A valid token always wins, so a
configuration fix works immediately if the token is right. If you are locked
out, restart the bridge to clear the in-memory ban table.

## The bridge cannot find OpenCode

**Symptoms:** startup error "OpenCode service not found", or `/health` works but
sessions fail.

- Start the service:
  ```bash
  opencode service start
  ```
- Check the discovery file:
  ```bash
  ls -l ~/.local/state/opencode/service.json
  ```
- If you use a custom state directory, set `XDG_STATE_HOME`.
- Or set both:
  ```bash
  export OPENCODE_URL=http://127.0.0.1:49374
  export OPENCODE_PASSWORD=...
  ```
- The URL must be loopback. `http://192.168.1.10:...` is rejected by design.

## `OpenCode URL must be loopback`

The bridge intentionally refuses non-loopback OpenCode URLs. Put OpenCode on
the same host as the bridge, or use an SSH tunnel and point `OPENCODE_URL` at
the local end of the tunnel.

## Sessions are missing or show the wrong status

- The session list is capped at 50 in the bridge and fetched with
  `parentID=null`.
- Status is in memory. After a bridge restart, statuses reset to `idle` until
  the next event or active-session reconciliation.
- A session with a pending question should show `waiting_input`; a pending
  permission request should show `needs_approval`.
- If the app shows a stale status, pull to refresh and reconnect the WebSocket.
- Check the bridge log for upstream event errors.

## A prompt is rejected as busy

The session already has a running turn. Wait for it to finish, stop it, or use
`delivery: "steer"` from a client that supports steering. The app's normal send
path queues by default.

## Questions or approvals do not appear

1. Confirm the WebSocket is open. The app shows a connection indicator.
2. Put the app in the foreground; mobile OSes suspend background sockets.
3. Check the OpenCode version. Event names are part of the upstream API and can
   change.
4. Check the bridge log for `upstream event` or `websocket` errors.
5. Refresh the session question list from REST:
   ```bash
   curl -H "Authorization: Bearer $AUTH_TOKEN" \
     http://127.0.0.1:8787/sessions/<id>/questions
   ```

If the question exists over REST but not over the socket, the problem is in the
WebSocket path, not the agent.

## Uploads are rejected

The error code tells you which check failed:

| Code | Meaning |
| --- | --- |
| `file_too_large` | Over `MAX_UPLOAD_MB`. |
| `total_too_large` | Over `MAX_UPLOAD_TOTAL_MB`. |
| `too_many_files` | Over `MAX_FILES_PER_MESSAGE`. |
| `type_not_allowed` | MIME type or extension is not in `ALLOWED_UPLOAD_TYPES`. |
| `binary_not_allowed` | A code/text file contained binary data, or the type is not allowed. |
| `outside_workdir` | The session workdir is outside `ALLOWED_WORKDIRS`. |
| `invalid_name` | The filename was empty or contained unsupported characters. |
| `session_not_found` | The session no longer exists. |

Check the bridge log for the exact rejected name. Do not paste the file contents
into an issue.

Uploads are written to `<workdir>/.opencode-uploads/<sessionId>/`. If that
directory is not writable, the upload fails even when the workdir itself is
allowed. Check ownership and permissions.

## Downloads fail or show the wrong type

- Downloads require the same bearer token as the rest of the API.
- The bridge serves the detected MIME type, not the picker's declared type.
- Text and code files use `/files/:id/text` for previews.
- A file record is tied to a session. If the session was deleted, the record
  may no longer be available.

## Push notifications do not arrive

- `PUSH_ENABLED=1` is required.
- The app needs an EAS `projectId` and a physical device. Simulators do not
  receive Expo push notifications reliably.
- Notification permission must be granted.
- The bridge must be able to reach `https://exp.host`.
- Test from the bridge:
  ```bash
  curl -X POST -H "Authorization: Bearer $AUTH_TOKEN" \
    http://127.0.0.1:8787/push/test
  ```
- Push payloads are generic. They do not contain message bodies.

## Web build cannot call the bridge

The bridge only adds CORS headers for exact origins listed in `CORS_ORIGINS`.
Find the origin in the browser address bar (for example
`http://localhost:8081`), add it to `bridge/.env`, and restart the bridge:

```dotenv
CORS_ORIGINS=http://localhost:8081
```

The value is a comma-separated list. Wildcards, paths, and credentials are
rejected. A preflight request is answered before authentication, but a real
request still needs the bearer token. For production, serve the app and bridge
behind one origin with a reverse proxy.

Do not start Chrome with security disabled. That weakens every site in the
browser, not just this one.

## The token disappears after a web refresh

By design. The web build uses `sessionStorage`; native builds use SecureStore.
Re-enter the token, or use the native app for a persistent connection.

## Android blocks cleartext HTTP

The app allows cleartext traffic for local and Tailscale use. If a platform
build still blocks it, check that you are using the generated app config and
not a stale native project. Prefer the HTTPS Tailscale URL when possible.

Do not use a public HTTP bridge. The token travels in the request and would be
visible to the network.

## iOS local network or ATS errors

- The app declares local networking and arbitrary loads for self-hosted
  bridges. This is a deliberate tradeoff.
- If the connection fails only on iOS, check the URL scheme (`http` vs
  `https`), the certificate, and the local-network permission prompt.
- A self-signed certificate is not trusted by the app. Use Tailscale's
  certificate or a trusted reverse proxy.

## `npm ci` fails

- Check `node --version`; use 22.13 or newer.
- Delete only `node_modules` and retry. Do not delete the lockfile.
- On Windows, run the command from the correct directory; the root scripts use
  `cd`.
- If the lockfile and `package.json` are out of sync, run `npm install` once,
  review the lockfile diff, and commit it.

## App typecheck or lint fails

```bash
cd app
npx tsc --noEmit
npm run lint
```

Common causes:

- A route file exports something other than a React component.
- An import uses a path outside `app/`.
- A new native module was added without generating types.
- The shared contract and `app/src/api/types.ts` disagree.

## Bridge tests fail

```bash
cd bridge
npm test
npm run build
```

The tests use temporary directories and do not need a live OpenCode service.
If a test fails after an OpenCode upgrade, check the adapter and mapping tests
first.

## Android build fails

- Confirm `app/android/gradlew` exists. If not, run
  `npx expo prebuild --platform android`.
- Confirm Java 21 and the SDK packages from
  `scripts/bootstrap-android-sdk.sh`.
- Check `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `JAVA_HOME`.
- On memory-constrained Linux, use the build-dir helper or build only one ABI:
  ```bash
  REACT_NATIVE_ARCHITECTURES=arm64-v8a ./scripts/build-apk.sh
  ```
- If `prepare-build-dirs.sh` fails, run with `SKIP_BUILD_BIND_MOUNTS=1` or use
  EAS.

## The APK installs but cannot connect

- The release APK is signed with the project key; a locally built debug APK is
  not a substitute and may require uninstalling the release build first.
- Confirm the phone can reach the bridge URL in a browser or with
  `curl` from another device on the same tailnet.
- Check that the token was copied into the app, not just into `.env`.
- Check the Android manifest for cleartext settings if you changed the app
  config.

## How to collect a useful report

Include:

- App version, Android/iOS version, and device model.
- Bridge version from `GET /config`.
- OpenCode version.
- The exact error code and message from the app.
- Relevant bridge log lines with tokens, paths, and personal data removed.
- Whether the connection is direct, Tailscale, or a tunnel.

Do not include `AUTH_TOKEN`, `OPENCODE_PASSWORD`, private source code, or
screenshots with real session titles.
