# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| `1.0.0-beta.x` | Yes, with best effort |
| Older pre-release snapshots | No |

This is a beta self-hosted project. Security fixes are applied to the current
branch; there is no long-term support window yet.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Include the affected version, the bridge version from `GET /config`, the
   OpenCode version, reproduction steps, and the impact.

If private reporting is not enabled, open a minimal public issue asking the
maintainer to enable it. Do not include exploit details, tokens, private source
code, or personal data in that issue.

## What to include

- A short description of the issue and the trust boundary it crosses.
- Steps to reproduce against a local test instance.
- The expected and actual behavior.
- The impact: token disclosure, arbitrary file read/write, command execution,
  authorization bypass, denial of service, or data exposure.
- Logs with tokens, paths, and personal data removed.
- A suggested fix, if you have one.

## Scope

In scope:

- The bridge authentication, authorization, upload, path, and logging code.
- The app's token storage and WebSocket handling.
- The documented deployment defaults that materially weaken security.
- Dependency or supply-chain issues in this repository.

Out of scope:

- Vulnerabilities in OpenCode itself. Report those to the OpenCode project.
- Vulnerabilities in Tailscale, Cloudflare, Expo, Telegram, or a model provider.
- A host that is already compromised.
- Missing hardening that is explicitly documented as a known gap in
  [docs/security.md](docs/security.md), unless you can show a concrete impact
  beyond the documented tradeoff.
- Social engineering, physical access, or denial of service against a public
  demo you do not own.

## Safe harbor

We will not pursue legal action for good-faith research that:

- Stays within this repository and a local instance you control.
- Avoids accessing other people's data.
- Avoids disrupting a public service.
- Reports the issue privately and gives us reasonable time to fix it.

Do not test against a bridge you do not own, even if it is reachable. The token
is a shell credential; using someone else's bridge is unauthorized access.

## Response

We aim to acknowledge a report within 7 days and to provide a fix or a
mitigation plan within 30 days for a confirmed high-impact issue. These are
targets, not guarantees. We will credit reporters who want credit, after a fix
is available.

## Token exposure

If you exposed `AUTH_TOKEN`, rotate it immediately:

```bash
openssl rand -hex 32
```

Update `bridge/.env`, restart the bridge, and update the app. If
`OPENCODE_PASSWORD` was exposed, rotate that separately. Revoking a GitHub token
or an Expo token is a different action; follow the provider's instructions.

## No secrets in reports

Never send:

- `AUTH_TOKEN` or `OPENCODE_PASSWORD`.
- Private keys, keystores, or signing material.
- Real source code from a private repository.
- Screenshots with real session titles, paths, IPs, or personal data.

Use a synthetic repository and a throwaway token for reproduction.
