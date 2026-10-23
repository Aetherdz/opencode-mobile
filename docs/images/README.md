# README images

The three README product screenshots are real captures rendered by the current
Expo web app against a local mock API with synthetic data. They are not
native-device or live-account captures. No GIF or third-party UI screenshot is
used as product imagery.

## Current captures

| File | Screen | Notes |
| --- | --- | --- |
| `sessions.png` | Sessions | Current light-theme web app; two synthetic demo sessions. |
| `chat.png` | Chat | Current light-theme web app; synthetic mixed-language messages and bottom toolbar with model selector beside attachment control. |
| `model-picker.png` | Model picker | Current light-theme Expo web build; synthetic catalog with selected state. |

## Other retained assets

The following assets are older illustrations/captures and are not used in the
current README product gallery. Do not describe them as freshly verified screens:
`hero.png`, `connect.png`, `sessions-light.png`, `sessions-ar.png`,
`sessions-fr.png`, `chat-light.png`, `question.png`, `social-preview.png`, and
`navigation-en.png`.

`settings-fr.png` was an earlier French capture that still showed the beta 1
version number and is no longer referenced by either README.

## Privacy checklist

Before committing an image, verify it contains **none** of the following:

- [ ] `AUTH_TOKEN`, `OPENCODE_PASSWORD`, or any token-like string.
- [ ] A real Tailscale hostname, tailnet name, IP address, or Cloudflare tunnel
      URL.
- [ ] A real home directory, username, machine name, or absolute path.
- [ ] Real session titles, repository names, branch names, commit messages, or
      file names from private work.
- [ ] Real people's names, avatars, email addresses, or phone numbers.
- [ ] A QR code, notification, or status bar item that reveals a private
      account.
- [ ] A diff, terminal, or error trace that exposes private code.
- [ ] A keyboard suggestion bar with personal text.

Use a demo project such as `demo-app`, `inventory-service`, or `notes`. Create
the sessions only for the capture, then delete them. Check the full image at
100% and inspect the status bar, notification shade, and keyboard.

## Capture tips

- Use the dark theme for the primary row and one light-theme image if there is
  room.
- Turn on airplane mode or hide the carrier name if the status bar shows a
  personal SIM.
- Clear notifications before capturing.
- Use a neutral wallpaper or a solid background behind the device frame.
- Do not add fake badges, ratings, or "featured" claims.
- Keep file sizes reasonable; optimize PNGs before committing.

## Social preview

`social-preview.png` is used for the repository's social card. The copy in
`.github/social-preview.png` is the one to upload manually in
**Settings → General → Social preview**. It must say "Unofficial" or "Not
affiliated with OpenCode" in the image or in the adjacent description. Do not
use the OpenCode logo in a way that implies endorsement.
