# Web deployment

The web client is the same Expo Router app as the native client, exported as a
single-page application. It is not a separate implementation, and it has the
same bridge requirements.

## Build

```bash
cd app
npm ci
npm run web:export
```

The output is `app/dist/`:

- `index.html` — the SPA shell.
- `_expo/` — hashed JavaScript and font assets.
- `manifest.webmanifest` — the PWA manifest.
- `icons/` — install icons.
- `_redirects` — SPA fallback for Netlify and Cloudflare Pages.
- `404.html` — SPA fallback for GitHub Pages, written by
  `scripts/patch-web-export.mjs`.

The export is a client-side app. There is no server-side rendering and no API
route in the bundle.

## Hosting

Serve `app/dist/` as static files and rewrite unknown paths to `index.html`:

### Caddy

```caddyfile
example.com {
  root * /srv/opencode-mobile-web
  try_files {path} /index.html
  file_server
}
```

### nginx

```nginx
server {
  listen 443 ssl http2;
  server_name example.com;
  root /srv/opencode-mobile-web;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### Netlify / Cloudflare Pages

Publish `app/dist`. The generated `_redirects` file already contains:

```text
/*  /index.html  200
```

### GitHub Pages

Publish the contents of `app/dist` to the Pages branch. The generated
`404.html` is a copy of the SPA shell, so client-side routes resolve on a hard
refresh.

The export uses root-relative asset paths and `start_url: "/"`. Serve it from a
domain root (a custom domain or a user/org Pages site). A project site under
`/<repository>/` needs a configured base URL and a fresh export; the default
build is not subpath-safe.

## Connecting to the bridge

The bridge is a separate origin by default. There are two supported layouts.

### Same origin (recommended)

Put the static app and the bridge behind one reverse proxy. For example, serve
the app at `/` and proxy `/bridge/*` to `127.0.0.1:8787` after stripping the
prefix:

```caddyfile
example.com {
  handle /bridge/* {
    uri strip_prefix /bridge
    reverse_proxy 127.0.0.1:8787
  }
  handle {
    root * /srv/opencode-mobile-web
    try_files {path} /index.html
    file_server
  }
}
```

Enter `https://example.com/bridge` as the bridge URL in the app. The token stays
on one origin, and no CORS configuration is needed.

### Separate origins

If the app is served from a different origin, add that exact origin to
`bridge/.env` and restart the bridge:

```dotenv
CORS_ORIGINS=https://mobile.example.com
```

Use a comma-separated list for more origins. Wildcards, credentials, and paths
are rejected. An empty value disables CORS. The bridge still requires the
bearer token; CORS only controls which browser pages may read responses.

## PWA behavior

The export includes a web app manifest and install icons. It does not register a
service worker, so there is no offline mode and no cached API data. That is
deliberate: a cache would increase the chance of stale session data and token
leakage.

On iOS, use Safari's **Add to Home Screen**. On Android and desktop Chromium,
use the install action in the address bar when available.

## Security notes

- The web client stores the bridge token in `sessionStorage`, not a cookie.
  Scripts on the same origin can read it. Do not put the app on an origin that
  loads untrusted third-party scripts.
- Prefer a same-origin proxy for public deployments. It removes CORS from the
  threat model and keeps the token on one host.
- Serve over HTTPS. A token sent over cleartext HTTP can be observed by a
  network attacker.
- Do not add a service worker that caches authenticated responses.
- The app has no telemetry. Any analytics added at the hosting layer must be
  disclosed separately.
