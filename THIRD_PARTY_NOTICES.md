# Third-party notices

This project includes third-party software, fonts, and assets. The list below
is a starting point and must be completed before the first public release.

## Fonts

- **Inter** — Copyright 2020 The Inter Project Authors. Licensed under the SIL
  Open Font License, Version 1.1.
- **Noto Sans Arabic** — Copyright The Noto Project Authors. Licensed under the
  SIL Open Font License, Version 1.1.
- **JetBrains Mono** — Copyright 2020 The JetBrains Mono Project Authors.
  Licensed under the SIL Open Font License, Version 1.1.

The full OFL text is in `licenses/OFL-1.1.txt`.

## Icons

- **Ionicons**, distributed through `@expo/vector-icons`, is licensed under the
  MIT License.

## Upstream project identity

The OpenCode name and logo belong to the upstream OpenCode project. The logo
source used in `app/assets/brand/` is MIT-licensed, but trademark rights are
separate. This project is unofficial and is not affiliated with or endorsed by
the OpenCode team. See `app/assets/brand/README.md`.

## Direct runtime dependencies

The tables below list the direct dependencies declared by each package. The
resolved transitive tree is in `app/package-lock.json` and
`bridge/package-lock.json`. Before distributing a binary, generate a complete
notice bundle from the production dependency tree and include the license text
from each package. The lockfiles are the source of truth for versions.

### App

| Package | Version | License |
| --- | --- | --- |
| `@expo-google-fonts/inter` | 0.4.2 | MIT AND OFL-1.1 |
| `@expo-google-fonts/noto-sans-arabic` | 0.4.3 | MIT AND OFL-1.1 |
| `@expo/metro-runtime` | 58.0.14 | MIT |
| `@expo/ui` | 58.0.21 | MIT |
| `@expo/vector-icons` | 15.1.1 | MIT |
| `@shopify/flash-list` | 2.3.2 | MIT |
| `@tanstack/react-query` | 5.104.5 | MIT |
| `expo` | 58.0.16 | MIT |
| `expo-clipboard` | 58.0.3 | MIT |
| `expo-constants` | 58.0.12 | MIT |
| `expo-device` | 58.0.5 | MIT |
| `expo-document-picker` | 58.0.4 | MIT |
| `expo-file-system` | 58.0.10 | MIT |
| `expo-font` | 58.0.9 | MIT |
| `expo-glass-effect` | 58.0.4 | MIT |
| `expo-haptics` | 58.0.7 | MIT |
| `expo-image` | 58.0.16 | MIT |
| `expo-image-picker` | 58.0.10 | MIT |
| `expo-linking` | 58.0.13 | MIT |
| `expo-notifications` | 58.1.5 | MIT |
| `expo-router` | 58.0.24 | MIT |
| `expo-secure-store` | 58.0.2 | MIT |
| `expo-sharing` | 58.0.19 | MIT |
| `expo-splash-screen` | 58.0.10 | MIT |
| `expo-status-bar` | 58.0.3 | MIT |
| `expo-symbols` | 58.0.4 | MIT |
| `expo-system-ui` | 58.0.6 | MIT |
| `expo-web-browser` | 58.0.6 | MIT |
| `react` | 19.3.0 | MIT |
| `react-dom` | 19.3.0 | MIT |
| `react-native` | 0.88.0 | MIT |
| `react-native-gesture-handler` | 3.3.0 | MIT |
| `react-native-reanimated` | 4.7.1 | MIT |
| `react-native-safe-area-context` | 5.10.1 | MIT |
| `react-native-screens` | 4.30.0 | MIT |
| `react-native-web` | 0.21.4 | MIT |
| `react-native-worklets` | 0.13.0 | MIT |
| `zod` | 4.6.7 | MIT |
| `zustand` | 5.0.15 | MIT |

### Bridge

| Package | Version | License |
| --- | --- | --- |
| `@fastify/multipart` | 9.4.0 | MIT |
| `@fastify/rate-limit` | 10.3.0 | MIT |
| `@fastify/websocket` | 11.3.4 | MIT |
| `dotenv` | 16.6.1 | BSD-2-Clause |
| `fastify` | 5.12.7 | MIT |
| `pino` | 9.14.0 | MIT |
| `zod` | 3.25.76 | MIT |

MIT, ISC, BSD, Apache-2.0, MPL-2.0, and other license texts are provided by the
respective packages. Keep their `LICENSE` files when packaging a release. If you
add a dependency with a new license, update this file and the release notice
bundle.

## Not distributed

- `cloudflared` is not distributed with this repository. Install it from the
  official Cloudflare release channel.
- Android APKs, signing keys, and local bridge data are not part of the source
  repository.
