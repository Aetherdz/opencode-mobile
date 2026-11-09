<div align="center">

# OpenCode Mobile

### *Your coding agent. Your machine. In your pocket.*

Unofficial 120fps fluid mobile & web client for the [OpenCode](https://github.com/anomalyco/opencode) coding agent with end-to-end token auth, live streaming diffs, and zero telemetry.

[Website](https://aetherdz.github.io/opencode-mobile/) · [Install Guide](https://aetherdz.github.io/opencode-mobile/#install) · [Documentation](docs/) · [Architecture](docs/architecture.md) · [Security](docs/security.md) · [Troubleshooting](docs/troubleshooting.md) · [Releases](https://github.com/Aetherdz/opencode-mobile/releases) · [العربية (Arabic)](README.ar.md)

<br/>

[![Release](https://img.shields.io/badge/release-v1.0.0--beta.10-0EA5E9?style=flat-square&logo=github&labelColor=0F172A)](https://github.com/Aetherdz/opencode-mobile/releases)
[![Build Status](https://img.shields.io/badge/build-passing-10B981?style=flat-square&logo=githubactions&logoColor=white&labelColor=0F172A)](https://github.com/Aetherdz/opencode-mobile/actions)
[![TypeScript](https://img.shields.io/badge/typescript-%5E5.8-3178C6?style=flat-square&logo=typescript&logoColor=white&labelColor=0F172A)](https://www.typescriptlang.org/)
[![Expo SDK 58](https://img.shields.io/badge/expo-SDK%2058-000000?style=flat-square&logo=expo&labelColor=0F172A)](https://expo.dev/)
[![Fastify](https://img.shields.io/badge/bridge-Fastify%205-000000?style=flat-square&logo=fastify&labelColor=0F172A)](https://fastify.dev/)
[![Zero Telemetry](https://img.shields.io/badge/telemetry-zero%20tracking-success?style=flat-square&logo=shield&labelColor=0F172A)](#-why-opencode-mobile)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square&labelColor=0F172A)](LICENSE)

</div>

---

## ⚡ 1-Command Quick Start

Install the authenticated bridge and terminal CLI on your host machine:

**Linux & macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/Aetherdz/opencode-mobile-dist/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/Aetherdz/opencode-mobile-dist/main/install.ps1 | iex
```

### 3 Steps to Code:
1. **Install**: Run the 1-command installer on the workstation running OpenCode.
2. **Scan QR**: Execute `opencode-mobile` in your terminal and scan the generated QR code with your phone.
3. **Code**: Review streamed responses, approve tools, and switch models on the go.

Diagnostic and management commands:
```bash
opencode-mobile status   # Verify bridge and agent health
opencode-mobile doctor   # Diagnose network, permissions, and port bindings
opencode-mobile down     # Safely stop active bridge daemon and tunnels
```

---

## 📦 Direct Downloads (`v1.0.0-beta.10`)

| Platform / Artifact | Target / Requirements | Package File | Checksum Verification |
| :--- | :--- | :--- | :--- |
| **Android APK** | Android 7.0+ (API 24+, arm64) | [opencode-mobile-1.0.0-beta.10.apk](https://github.com/Aetherdz/opencode-mobile/releases/download/v1.0.0-beta.10/opencode-mobile-1.0.0-beta.10.apk) | [SHA-256 Checksum](https://github.com/Aetherdz/opencode-mobile/releases/download/v1.0.0-beta.10/opencode-mobile-1.0.0-beta.10.apk.sha256) |
| **Web PWA Bundle** | Modern Browsers (Chrome, Safari, Firefox) | [opencode-mobile-web-1.0.0-beta.10.zip](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) | [SHA256SUMS](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) |
| **Bridge Server** | Node.js >=22.13 (Linux, macOS, Windows) | [opencode-mobile-bridge-1.0.0-beta.10.tar.gz](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) | [SHA256SUMS](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) |
| **CLI Distribution** | Linux, macOS, Windows | [opencode-mobile-dist](https://github.com/Aetherdz/opencode-mobile-dist) | [SHA256SUMS](https://github.com/Aetherdz/opencode-mobile-dist) |

---

## 🖥️ Visual Preview

<p align="center">
  <img src="docs/assets/terminal-boot.svg" width="49%" alt="OpenCode Mobile Terminal Startup Diagnostics" />
  <img src="docs/assets/terminal-qr.svg" width="49%" alt="1-Tap Terminal Pairing QR Code" />
</p>

---

## ✨ Why OpenCode Mobile?

- 🚀 **120fps Claude-Grade Fluid UI**: Native spring physics (`stiffness: 380, damping: 28`), tactile `PressableScale` tap feedback, and editorial dark/light themes.
- 🧠 **Universal Model Selector**: Instantly switch between DeepSeek (V3/R1), Claude 3.7 Sonnet, Gemini 4 Argon, OpenAI GPT-4o, and local Ollama models.
- 📱 **1-Tap QR Auto-Connect**: Scan the terminal QR code to pair securely with zero manual IP/token typing.
- ⚡ **Live Approvals & Diffs**: Streamed WebSocket/SSE responses, collapsible syntax diffs, and interactive choice chips for agent questions.
- 🛡️ **Zero-Telemetry Self-Hosted Bridge**: Hardened loopback Fastify bridge, constant-time bearer auth, SecureStore encrypted tokens, and strict `ALLOWED_WORKDIRS` isolation.
- 🌍 **4 Native Languages**: Bidirectional English, Arabic (full RTL), French, and Spanish localization with system font scaling.

---

## 🌐 Secure Remote Access

- **Private Tailscale Mesh (Recommended)**: Point-to-point WireGuard encrypted tunnel without public ports:
  ```bash
  tailscale serve --bg http://127.0.0.1:8787
  ```
- **Ephemeral Cloudflare Quick Tunnel**: Zero-config temporary sharing with end-to-end token validation:
  ```bash
  opencode-mobile --tunnel quick
  ```

---

## 🛠️ CLI Commands & Config

### Terminal CLI Commands

| Command | Action |
| :--- | :--- |
| `opencode-mobile` | Start bridge, print pairing QR code, and open tunnel |
| `opencode-mobile-up` | Launch bridge as a background daemon service |
| `opencode-mobile-down` | Terminate bridge daemon and active tunnels |
| `npm run mobile:share` | Generate instant secure pairing link & ANSI QR from source |

### Key Configuration (`bridge/.env`)

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `AUTH_TOKEN` | *(required)* | 32+ character bearer secret token (`openssl rand -hex 32`) |
| `HOST` / `PORT` | `127.0.0.1` / `8787` | Local loopback bind address and port |
| `ALLOWED_WORKDIRS` | `~/projects` | Strict filesystem boundary for session access |
| `CORS_ORIGINS` | *(empty)* | Allowed origins for web client (e.g. `http://localhost:8081`) |
| `MAX_UPLOAD_MB` | `25` | Maximum upload attachment size per file |
| `RATE_LIMIT_PER_MINUTE` | `180` | Rate limit protection per client IP |
| `LOG_LEVEL` | `info` | Pino logger level (authorization tokens strictly redacted) |

---

## 💻 From Source (Developers)

```bash
git clone https://github.com/Aetherdz/opencode-mobile.git && cd opencode-mobile
npm run install:bridge && npm run install:app
npm run mobile:share
```

Run test and verification suites:
```bash
npm run check             # App typecheck, bridge typecheck, and linter
npm test                  # Full unit test suite (107 tests)
```

---

## 📜 License & Disclaimer

Distributed under the [MIT License](LICENSE). OpenCode Mobile is an independent community project and is not affiliated with or endorsed by OpenCode.
