# README images

These files are the real captures used in `README.md` and `README.ar.md`.
They were taken from the web build with synthetic demo data, so they contain no
real token, path, address, or session title. Keep the filenames stable so the
README links do not break.

## Current captures

| File | Screen | Notes |
| --- | --- | --- |
| `hero.png` | README hero | Wordmark banner for the top of both READMEs. |
| `connect.png` | Connect | Neutral demo address, empty token field, connect action. |
| `sessions.png` | Sessions | Three demo sessions with invented project names. |
| `sessions-light.png` | Sessions | The same screen in the light theme. |
| `sessions-ar.png` | Sessions | Arabic, right-to-left layout. |
| `sessions-fr.png` | Sessions | French layout. |
| `chat.png` | Chat | Short assistant reply, one tool activity row, composer. |
| `chat-light.png` | Chat | The same screen in the light theme. |
| `question.png` | Chat | Question card with two generic options. |
| `social-preview.png` | Repository preview | Wordmark and the unofficial disclaimer. 1280×640. |

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
