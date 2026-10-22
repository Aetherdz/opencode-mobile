# Contributing

Thanks for helping. This is a small, self-hosted project with a security-sensitive
surface. Keep changes focused and explain the user-visible effect.

## Before you start

- Read [README.md](README.md), [docs/architecture.md](docs/architecture.md), and
  [docs/security.md](docs/security.md).
- For a security issue, do not open a public issue. Follow
  [SECURITY.md](SECURITY.md).
- For a large feature, open an issue first so we can agree on scope.
- Do not include tokens, private source code, personal paths, or screenshots
  with real session data in issues or pull requests.

## Development setup

```bash
git clone https://github.com/Aetherdz/opencode-mobile.git
cd opencode-mobile
npm run install:app
npm run install:bridge
npm run check
```

Node 22.13+ is required. See [docs/development.md](docs/development.md) for
Android, iOS, Windows, WSL2, and server notes.

## What to change

Good contributions:

- Fix a reproducible bug with a test or a clear manual reproduction.
- Improve accessibility, RTL behavior, or keyboard behavior.
- Harden authentication, upload validation, path checks, or logging.
- Add documentation that matches the code.
- Add a small, well-scoped test for the bridge.
- Improve the web build without weakening the token model.

Please avoid:

- A second agent, a shell/terminal UI, or a new session store.
- Telemetry, analytics, crash reporting, or remote logging.
- Weakening `ALLOWED_WORKDIRS`, token checks, upload checks, or TLS guidance.
- Committing `node_modules`, `data/`, `.env`, APKs, keystores, or generated
  native projects.
- Adding a native dependency without a prebuild and a device test.
- Reformatting unrelated files.

## Branch and commits

Use a short branch name:

```text
fix/upload-size-error
feat/question-card-focus
docs/tailscale-setup
```

Write commit messages in the imperative mood:

```text
fix: reject uploads outside the session workdir

Explain the cause and the user-visible effect. Keep the body short.
```

Do not mix a refactor with a behavior change in the same commit. Do not force
push a branch that someone else is reviewing.

## Tests and checks

Before opening a pull request:

```bash
npm run check
npm run build:bridge
cd app && npx expo export --platform web
```

For a UI change, include:

- Device or simulator used.
- Android/iOS version.
- Light and dark theme.
- Arabic and English.
- 100% and 130% font scale if the layout is affected.
- A screen recording or screenshots with private data removed.

For a bridge change, add or update a test under `bridge/test/`.

## Pull request checklist

- [ ] The change is scoped and described.
- [ ] `npm run check` passes.
- [ ] The bridge builds.
- [ ] The web export passes, or the PR explains why it is not affected.
- [ ] New behavior is documented.
- [ ] No secrets, private paths, uploads, or personal data are included.
- [ ] Screenshots follow [docs/images/README.md](docs/images/README.md).
- [ ] The PR states whether it changes the API, the protocol, or the storage
      format.

## Translation

English is the source language. Arabic UI strings live in
`app/src/lib/i18n.ts`. Keep technical terms and commands in English inside
Arabic sentences where that is clearer. Do not machine-translate a security
warning without reviewing it.

## Code style

- TypeScript strict mode.
- Two-space indentation, single quotes in the app, double quotes in the bridge.
- Keep the three contract copies in sync:
  `shared/contract.ts`, `bridge/src/types.ts`, `app/src/api/types.ts`.
- Prefer small functions and explicit error codes.
- Do not log tokens, authorization headers, cookies, query tokens, or file
  contents.

## License

By contributing, you agree that your contribution is licensed under the MIT
License in [LICENSE](LICENSE). Do not add code or assets with an incompatible
license. Add attribution to [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
when you add a third-party asset.
