# Release guide

This document covers the public beta release path: versioning, the bridge and
web bundles, the installable APK, checksums, and the GitHub release.

The project uses a split distribution model:

- **Source repository** — source code, CI, release bundles, and the APK.
- **Distribution repository** — `install.sh`, `install.ps1`, and the release
  URL. It never contains application source or secrets.

## Versioning

The current public beta version is recorded in the root and app package
metadata. At this revision it is `1.0.0-beta.9`; the release tag is `v` plus
that version (`v1.0.0-beta.9`).

When you bump the version, update all of these together:

| File | Field |
| --- | --- |
| `package.json` | `version` |
| `app/package.json` | `version` |
| `bridge/package.json` | `version` and `bridge/package-lock.json` |
| `app/app.json` | `expo.version` |
| `app/app.json` | `expo.android.versionCode` (integer, always increases) |
| `app/app.json` | `expo.ios.buildNumber` (string, always increases) |
| `CHANGELOG.md` | New dated section |

Use `npm version <version> --no-git-tag-version` inside `app/` and `bridge/` to
update the package metadata without creating a tag.

## Before a release

1. Run the full local check from the repository root:

   ```bash
   npm run check
   npm run build:bridge
   npm run web:export
   ```

2. Confirm the bridge and web bundles start from a clean tree.
3. Run `git status --short` and confirm no `.env`, `data/`, keystore, token, or
   personal path is staged.
4. Confirm the app identity and the unofficial disclaimer are still correct.
5. Update `CHANGELOG.md` and the release notes.

## Bridge bundle

The installer downloads a self-contained production tree:

```bash
npm --prefix bridge ci --no-audit --no-fund
npm --prefix bridge run build
npm --prefix bridge prune --omit=dev
mkdir -p release/bridge
cp bridge/package.json bridge/package-lock.json bridge/.env.example release/bridge/
cp -a bridge/dist bridge/node_modules release/bridge/
tar -czf "opencode-mobile-bridge-${VERSION}.tar.gz" -C release/bridge .
(cd release/bridge && zip -qr "../../opencode-mobile-bridge-${VERSION}.zip" .)
```

The archive root must contain `package.json`, `package-lock.json`, `dist/`, and
production `node_modules/`. The installer verifies this layout. Keep tests,
TypeScript sources, and development dependencies out of the production archive.

## Web bundle

```bash
npm --prefix app ci --no-audit --no-fund
npm --prefix app run web:export
tar -czf "opencode-mobile-web-${VERSION}.tar.gz" -C app/dist .
```

`app/dist/` is a single-page Expo web export with PWA metadata, `404.html`,
`_redirects`, and the install icons. It has no runtime build step.

See [web.md](web.md) for hosting and CORS.

## Android APK

The beta ships a release-signed, arm64-v8a APK built by
`.github/workflows/android-release.yml`. The workflow uses a project keystore
stored only in GitHub Actions secrets and verifies the certificate and package
metadata before uploading the artifact.

### Signing secrets

Generate the keystore outside the repository, back it up, and add these
repository secrets:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 of the `.keystore` file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias, for example `opencode-mobile` |
| `ANDROID_KEY_PASSWORD` | Key password |
| `ANDROID_KEY_CERT_SHA256` | Optional. SHA-256 of the signing certificate, with or without colons. When set, the workflow rejects any APK whose signer does not match. |

The workflow always rejects a debug-signed APK. Setting
`ANDROID_KEY_CERT_SHA256` adds certificate pinning and is strongly recommended.
Never commit the keystore, passwords, or `keystore.properties`.

### Build and verify

```bash
gh workflow run android-release.yml --ref main
gh run list --workflow android-release.yml --limit 1
gh run watch <run-id>
gh run download <run-id>
```

The artifact is named `opencode-mobile-<version>-<sha>.apk` and includes a
`.sha256` file. Verify it before publishing:

```bash
apksigner verify --verbose --print-certs opencode-mobile-*.apk
aapt dump badging opencode-mobile-*.apk | grep -E "^(package|sdkVersion|targetSdkVersion):"
sha256sum -c opencode-mobile-*.apk.sha256
```

Rename the verified file to the stable asset name and attach it to the release:

```bash
cp opencode-mobile-1.0.0-beta.9-<sha>.apk opencode-mobile-1.0.0-beta.9.apk
gh release upload v1.0.0-beta.9 opencode-mobile-1.0.0-beta.9.apk
```

Then regenerate `SHA256SUMS` over every release asset and upload it with
`--clobber`.

### EAS alternative

EAS is still supported for iOS and for maintainers who prefer managed Android
signing. It is not required for the beta APK.

```bash
cd app
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

### Local build

The generated Expo template signs `release` with the debug key by default. Use
`scripts/configure-android-signing.cjs` with the same four environment
variables, then run `assembleRelease`. A debug APK is for QA only and must not
be presented as a production release.

## GitHub release

The `Release` workflow runs on `v*` tags or manually with an existing tag. It:

1. Builds the bridge production tree.
2. Exports the web app.
3. Creates bridge and web `.tar.gz` and `.zip` archives.
4. Writes `SHA256SUMS` over every asset.
5. Creates or updates the GitHub Release.

The release workflow does **not** build or sign the APK. Build it with the
`android-release` workflow, then attach the verified file:

1. Download the APK artifact from the Android workflow.
2. Rename it to `opencode-mobile-<version>.apk`.
3. Attach it to the release:

   ```bash
   gh release upload v1.0.0-beta.9 opencode-mobile-1.0.0-beta.9.apk --clobber
   ```

4. Regenerate and upload the checksum file over every asset:

   ```bash
   gh release download v1.0.0-beta.9 --dir release-assets
   rm -f release-assets/SHA256SUMS release-assets/*-debug.apk
   (cd release-assets && sha256sum * > SHA256SUMS)
   gh release upload v1.0.0-beta.9 release-assets/SHA256SUMS --clobber
   ```

Use a tag that points at the source commit used for the APK. If the tag is
older than the APK source, publish a new tag instead of rewriting a public tag.

The distribution installer expects these exact names:

| Asset | Purpose |
| --- | --- |
| `opencode-mobile-bridge-<version>.tar.gz` | POSIX installer |
| `opencode-mobile-bridge-<version>.zip` | Windows installer |
| `opencode-mobile-<version>.apk` | Android app |
| `SHA256SUMS` | Checksums for every asset |

The web archives are optional for the installer and useful for self-hosting.

## Release checklist

- [ ] Version bumped in all files and `versionCode` increased.
- [ ] `npm run check`, bridge build, and web export pass.
- [ ] No secrets, `.env`, `data/`, keystores, or personal paths in the tree.
- [ ] `CHANGELOG.md` has a dated entry.
- [ ] Release tag matches the app version.
- [ ] Bridge and web archives contain the expected roots.
- [ ] APK is signed with the release key, not the debug key.
- [ ] `SHA256SUMS` covers every attached asset.
- [ ] Installer smoke test passes against the published release.
- [ ] The unofficial-project disclaimer is still visible.

## Rollback

Delete or mark the GitHub Release as a pre-release, and publish a new patch
version. Do not reuse a tag with different bytes: installed clients and
checksums depend on immutable assets.
