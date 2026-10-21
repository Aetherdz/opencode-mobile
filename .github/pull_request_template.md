## Summary

<!-- What changed and why? Keep it short. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Security hardening
- [ ] Documentation
- [ ] Refactor with no behavior change
- [ ] Build, CI, or dependency change

## Testing

<!-- List the commands and the device/simulator used. -->

```bash
npm run check
npm run build:bridge
cd app && npx expo export --platform web
```

- Device / simulator:
- Android / iOS / browser version:
- Theme: dark / light
- Language: English / Arabic
- Font scale:

## Screenshots or recording

<!-- Remove tokens, paths, real session titles, and personal data before attaching. -->

## Checklist

- [ ] The change is scoped and described.
- [ ] `npm run check` passes.
- [ ] The bridge builds.
- [ ] The web export passes, or this PR explains why it is not affected.
- [ ] New behavior is documented.
- [ ] The shared contract copies are in sync if the protocol changed.
- [ ] No secrets, private paths, uploads, or personal data are included.
- [ ] Screenshots follow `docs/images/README.md`.
- [ ] This PR states whether it changes the API, the protocol, or storage.

## Breaking change

<!-- Describe the impact and the migration path, or write "None". -->
