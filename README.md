<div align="center">

# OpenCode Mobile

### *Your coding agent. Your machine. In your pocket.*

Unofficial 120fps fluid mobile & web client for the [OpenCode](https://github.com/anomalyco/opencode) coding agent with end-to-end token auth, live streaming diffs, and zero telemetry.

[Website](https://aetherdz.github.io/opencode-mobile/) · [Install Guide](https://aetherdz.github.io/opencode-mobile/#install) · [Documentation](docs/) · [Architecture](docs/architecture.md) · [Security](docs/security.md) · [Releases](https://github.com/Aetherdz/opencode-mobile/releases) · [العربية (Arabic)](README.ar.md)

<br/>

[![Release](https://img.shields.io/badge/release-v1.0.0--beta.10-0EA5E9?style=flat-square&logo=github&labelColor=0F172A)](https://github.com/Aetherdz/opencode-mobile/releases)
[![Build Status](https://img.shields.io/badge/build-passing-10B981?style=flat-square&logo=githubactions&logoColor=white&labelColor=0F172A)](https://github.com/Aetherdz/opencode-mobile/actions)
[![TypeScript](https://img.shields.io/badge/typescript-%5E5.8-3178C6?style=flat-square&logo=typescript&logoColor=white&labelColor=0F172A)](https://www.typescriptlang.org/)
[![Expo SDK 58](https://img.shields.io/badge/expo-SDK%2058-000000?style=flat-square&logo=expo&labelColor=0F172A)](https://expo.dev/)
[![Fastify](https://img.shields.io/badge/bridge-Fastify%205-000000?style=flat-square&logo=fastify&labelColor=0F172A)](https://fastify.dev/)
[![Zero Telemetry](https://img.shields.io/badge/telemetry-zero%20tracking-success?style=flat-square&logo=shield&labelColor=0F172A)](#%EF%B8%8F-architecture)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square&labelColor=0F172A)](LICENSE)

<br/>

<p align="center">
  <img src="docs/images/hero.png" alt="OpenCode Mobile Hero" width="860" />
</p>

</div>

---

## ⚡ 1-Command Setup & Terminal QR

Install the bridge and terminal CLI on your workstation:

```bash
# Linux & macOS
curl -fsSL https://raw.githubusercontent.com/Aetherdz/opencode-mobile-dist/main/install.sh | bash

# Pair instantly with your mobile device
opencode-mobile
```

*(Windows PowerShell: `irm https://raw.githubusercontent.com/Aetherdz/opencode-mobile-dist/main/install.ps1 | iex`)*

<p align="center">
  <img src="docs/images/tui-banner.svg" width="840" alt="Terminal QR Pairing Banner" />
</p>

---

## 📱 App Experience Gallery

### Core Workflow

| 1. Auto-Connect | 2. Workspaces | 3. Live Chat | 4. Model Selector | 5. Approvals |
| :---: | :---: | :---: | :---: | :---: |
| <img src="docs/images/connect.png" width="175" alt="1-Tap QR Connect Screen" /> | <img src="docs/images/sessions.png" width="175" alt="Elevated Session Cards" /> | <img src="docs/images/chat.png" width="175" alt="Streamed Chat & Diffs" /> | <img src="docs/images/model-picker.png" width="175" alt="Universal Model Selector" /> | <img src="docs/images/question.png" width="175" alt="Agent Questions & Approvals" /> |
| **1-Tap QR Connect**<br/>Auto-detects credentials | **Elevated Sessions**<br/>Tactile spring cards | **Live Stream & Diffs**<br/>WebSocket turn delivery | **Universal Model Switcher**<br/>DeepSeek, Claude, Gemini | **Inline Approvals**<br/>Safe tool permissions |

### Themes & Multilingual Experience

| 1. Fluid Drawer | 2. Light Chat | 3. Light Sessions | 4. Arabic RTL | 5. French UI |
| :---: | :---: | :---: | :---: | :---: |
| <img src="docs/images/navigation-en.png" width="175" alt="App Drawer Navigation" /> | <img src="docs/images/chat-light.png" width="175" alt="Editorial Light Chat" /> | <img src="docs/images/sessions-light.png" width="175" alt="Editorial Light Sessions" /> | <img src="docs/images/sessions-ar.png" width="175" alt="Arabic RTL Sessions" /> | <img src="docs/images/sessions-fr.png" width="175" alt="French Sessions" /> |
| **Claude-Grade Drawer**<br/>120fps spring navigation | **Warm Light Theme**<br/>Parchment contrast | **Editorial Surfaces**<br/>Hairline visual dividers | **Full Arabic RTL**<br/>Native bidirectional typography | **Multilingual**<br/>EN, AR, FR, ES native |

---

## 🏗️ Architecture

```mermaid
flowchart TD
  subgraph Client["1. Mobile & Web Clients"]
    App["Expo Mobile App (Android / iOS)<br/>• 120fps Native Springs • SecureStore"]
    Web["Web Client (PWA ready)"]
  end

  subgraph Network["2. Transport Layer"]
    Mesh["Private Tailscale / Local Wi-Fi (WireGuard encrypted)"]
    Tunnel["Optional Ephemeral Cloudflare Tunnel"]
  end

  subgraph Bridge["3. Fastify Bridge (127.0.0.1:8787)"]
    Auth["Bearer Auth Gate (Constant-Time)"]
    Sandbox["Workspace Confinement (ALLOWED_WORKDIRS)"]
    Events["SSE → WebSocket Hub (Sub-50ms)"]
  end

  subgraph Host["4. Workstation Core"]
    OpenCode["OpenCode Local Service"]
    Models["Universal Models (DeepSeek / Claude 3.7 / Gemini 4 Argon / Ollama)"]
  end

  App & Web --> Mesh & Tunnel
  Mesh & Tunnel --> Auth
  Auth --> Sandbox --> Events
  Events --> OpenCode --> Models
```

---

## 📦 Direct Downloads (`v1.0.0-beta.10`)

| Artifact | Target | Package File | Checksum |
| :--- | :--- | :--- | :--- |
| **Android APK** | Android 7.0+ (arm64-v8a) | [opencode-mobile-1.0.0-beta.10.apk](https://github.com/Aetherdz/opencode-mobile/releases/download/v1.0.0-beta.10/opencode-mobile-1.0.0-beta.10.apk) | [SHA-256 Checksum](https://github.com/Aetherdz/opencode-mobile/releases/download/v1.0.0-beta.10/opencode-mobile-1.0.0-beta.10.apk.sha256) |
| **Web PWA Bundle** | Modern Browsers | [opencode-mobile-web-1.0.0-beta.10.zip](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) | [SHA256SUMS](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) |
| **Bridge Server** | Node.js >=22.13 | [opencode-mobile-bridge-1.0.0-beta.10.tar.gz](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) | [SHA256SUMS](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) |
| **CLI Installer** | Linux, macOS, Win | [opencode-mobile-dist](https://github.com/Aetherdz/opencode-mobile-dist) | [SHA256SUMS](https://github.com/Aetherdz/opencode-mobile-dist) |

---

## 🛠️ Essential Commands & Config

| Command | Action |
| :--- | :--- |
| `opencode-mobile` | Start bridge, render ANSI pairing QR code, and open tunnel |
| `opencode-mobile status` | Verify bridge connection and local OpenCode health |
| `opencode-mobile doctor` | Diagnose network, permissions, and port bindings |
| `opencode-mobile down` | Terminate bridge background service and active tunnels |
| `npm run mobile:share` | Generate instant secure pairing link & ANSI QR from source |

### Key Environment Variables (`bridge/.env`)
- `AUTH_TOKEN`: 32+ character bearer secret token (`openssl rand -hex 32`).
- `HOST` / `PORT`: Loopback address (`127.0.0.1`) and listening port (`8787`).
- `ALLOWED_WORKDIRS`: File boundary for sessions (default: `~/projects`).
- `CORS_ORIGINS`: Allowed browser origins for web client (e.g. `http://localhost:8081`).

---

## 📜 License & Community

Distributed under the [MIT License](LICENSE). OpenCode Mobile is an independent community project and is not affiliated with or endorsed by OpenCode.
