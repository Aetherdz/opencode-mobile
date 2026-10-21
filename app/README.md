# OpenCode Mobile — app

Expo client for the OpenCode Mobile bridge.

The project-level documentation is the source of truth:

- `../README.md`
- `../docs/architecture.md`
- `../docs/development.md`
- `../docs/security.md`

## Local development

```bash
npm ci
npx expo start
```

The first screen asks for the bridge URL and token. On native builds the token
is stored with SecureStore; the web build uses sessionStorage.
