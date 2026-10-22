# Deployment

The bridge is a small authenticated gateway. It is designed for one owner, one
host, and a private network. These recipes cover three supported layouts:

1. Native Node process on Linux, macOS, or Windows.
2. Docker Compose on Linux with host networking.
3. A systemd service on Linux.

The static web client can be served by Caddy, nginx, Netlify, Cloudflare Pages,
or GitHub Pages. See [docs/web.md](../docs/web.md).

## Native

This is the most portable option and the only one recommended for Docker
Desktop on macOS or Windows.

```bash
git clone https://github.com/Aetherdz/opencode-mobile.git
cd opencode-mobile

# Build the bridge
cd bridge
npm ci
npm run build

# Configure
cp .env.example .env
# Edit .env: set AUTH_TOKEN, ALLOWED_WORKDIRS, and the OpenCode credentials.
# Generate a token with: openssl rand -base64 48

# Run
npm start
```

The default listener is `127.0.0.1:8787`. Keep it on loopback and use Tailscale
or a reverse proxy for remote access.

## Docker Compose (Linux only)

Docker Desktop on macOS and Windows cannot use `network_mode: host`. The bridge
must reach OpenCode on `127.0.0.1`, and the workdir paths sent to OpenCode must
match the host. Run natively there instead.

### Requirements

- Linux with Docker Engine and the Compose plugin.
- OpenCode running on the host. If OpenCode also runs in a container, put both
  containers in the same network namespace or use a native bridge.
- A project directory that the bridge may read and write.

### Install

```bash
cd deploy
cp .env.example .env
# Edit .env:
#   OPENCODE_WORKDIR=/home/you/projects
#   AUTH_TOKEN=<random>
#   OPENCODE_PASSWORD=<the OpenCode password>

docker compose up -d --build
docker compose ps
curl http://127.0.0.1:8787/health
```

The workdir is mounted at the same absolute path inside the container. Do not
change that mapping: OpenCode resolves session directories on the host, and a
different container path would point at the wrong files.

Multiple workdirs are possible. Add a volume line and the matching path for each
one, and set `ALLOWED_WORKDIRS` to a comma-separated list in `deploy/.env`:

```yaml
volumes:
  - /home/you/projects:/home/you/projects
  - /home/you/work:/home/you/work
```

```dotenv
ALLOWED_WORKDIRS=/home/you/projects,/home/you/work
```

`ALLOWED_WORKDIRS` in the environment overrides the single-workdir value that
Compose sets by default.

### Operate

```bash
cd deploy
docker compose logs -f bridge
docker compose restart bridge
docker compose down
```

Bridge data lives in the `bridge-data` volume. Back it up with:

```bash
docker run --rm -v opencode-mobile_bridge-data:/data -v "$PWD":/backup \
  alpine tar czf /backup/bridge-data.tgz -C /data .
```

The volume name may differ if you changed the Compose project name.

### Upgrade

```bash
cd deploy
git pull
docker compose build --pull
docker compose up -d
```

The data volume is not removed by an upgrade. Keep the previous image tag if you
need a rollback.

## systemd

Use this for a native install on a Linux server. The unit assumes:

- Code at `/opt/opencode-mobile`.
- A dedicated `opencode-mobile` user.
- Configuration at `/etc/opencode-mobile/bridge.env`.
- `DATA_DIR=/var/lib/opencode-mobile`.

```bash
sudo useradd --system --home /var/lib/opencode-mobile --shell /usr/sbin/nologin opencode-mobile
sudo mkdir -p /opt/opencode-mobile /etc/opencode-mobile /var/lib/opencode-mobile
sudo chown -R opencode-mobile:opencode-mobile /opt/opencode-mobile /var/lib/opencode-mobile

# Copy the repository to /opt/opencode-mobile, then build as the service user.
sudo -u opencode-mobile bash -c 'cd /opt/opencode-mobile/bridge && npm ci && npm run build'

sudo cp deploy/systemd/opencode-mobile-bridge.service /etc/systemd/system/
sudo cp deploy/.env.example /etc/opencode-mobile/bridge.env
sudo chmod 600 /etc/opencode-mobile/bridge.env
sudo editor /etc/opencode-mobile/bridge.env

sudo systemctl daemon-reload
sudo systemctl enable --now opencode-mobile-bridge
sudo systemctl status opencode-mobile-bridge
curl http://127.0.0.1:8787/health
```

Set `ALLOWED_WORKDIRS` to directories the service user can read and write. If
they live under `/home`, make sure the permissions grant access to
`opencode-mobile`. The unit keeps `/home` writable because uploads are written
next to the session workdir.

View logs with:

```bash
journalctl -u opencode-mobile-bridge -f
```

## Caddy: same-origin web and bridge

Copy the web export to `/srv/opencode-mobile-web`:

```bash
cd app
npm ci
npm run web:export
sudo mkdir -p /srv/opencode-mobile-web
sudo cp -a dist/. /srv/opencode-mobile-web/
```

Edit `deploy/caddy/Caddyfile`, then:

```bash
sudo cp deploy/caddy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Enter `https://mobile.example.com/bridge` as the bridge URL in the app. The
`/bridge` prefix is stripped before the request reaches the bridge, so the app's
normal paths and WebSocket upgrade work.

Because the bridge has `trustProxy` disabled, it sees Caddy's loopback address
for every client. Rate limiting and failed-auth bans are therefore global. That
is acceptable for a single-owner deployment but not for a shared public service.

## Tailscale

For a native bridge without a public reverse proxy:

```bash
tailscale serve --bg http://127.0.0.1:8787
tailscale serve status
```

Use the resulting HTTPS tailnet URL in the app. Tailscale terminates TLS and
only exposes the service to devices in your tailnet. Do not use Funnel unless
you intentionally want a public endpoint and have reviewed the token and rate
limit implications.

## Security checklist

- [ ] `AUTH_TOKEN` is random, at least 32 characters, and not reused.
- [ ] `.env` is mode `600` and not tracked by git.
- [ ] `HOST` remains `127.0.0.1` unless a reverse proxy on the same host is the
      only exposed listener.
- [ ] `ALLOWED_WORKDIRS` is narrow and does not include the filesystem root.
- [ ] `OPENCODE_URL` is loopback.
- [ ] Remote access uses Tailscale or HTTPS, never plain HTTP over an untrusted
      network.
- [ ] `CORS_ORIGINS` is empty or lists exact trusted origins.
- [ ] The data directory is backed up and readable only by the service user.
- [ ] The token is rotated after a device is lost.
- [ ] Access logs are disabled or strip query strings; WebSocket upgrades use
      short-lived tickets, not the bearer token.

## Troubleshooting

**The bridge starts but every request returns 401.**
The token in the app must match `AUTH_TOKEN` exactly. Do not add quotes or
whitespace to the value in `.env`.

**`OpenCode service not found`.**
Start OpenCode, or set `OPENCODE_URL` and `OPENCODE_PASSWORD` explicitly. The
URL must be loopback.

**Docker cannot reach OpenCode.**
`network_mode: host` is Linux-only. On Docker Desktop, run the bridge natively.
If OpenCode is also containerized, put it in the same network namespace.

**Uploads fail with permission errors.**
The service user must be able to write inside the session workdir. Check the
directory ownership and the `ALLOWED_WORKDIRS` value.

**The web client cannot read responses.**
Use the same-origin proxy, or add the exact app origin to `CORS_ORIGINS`. See
[docs/troubleshooting.md](../docs/troubleshooting.md).
