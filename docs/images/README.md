# README images

The current files in this directory are generated placeholders. Replace them
with clean captures before the public release. Keep the same filenames so the
README links do not change.

## Required captures

| File | Screen | What it should show |
| --- | --- | --- |
| `connect.png` | Connect | URL field with a neutral Tailscale-style demo address, token field empty, primary connect action. |
| `sessions.png` | Sessions | Three demo sessions, one waiting for input, one running, one idle. Use invented project names. |
| `chat.png` | Chat | A short assistant reply, one tool activity row, and the composer. Do not show a real diff or terminal output. |
| `question.png` | Chat | A question card with two generic options and the free-text field. |
| `social-preview.png` | Repository preview | The wordmark and the unofficial disclaimer. 1280×640 or 1200×630. |

Recommended phone captures: 1080×2400 or 1170×2532, portrait. The README can
scale them down. Use the same theme and font scale for all four.

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

`social-preview.png` is used for the repository's social card and for the
website metadata. It must say "Unofficial" or "Not affiliated with OpenCode" in
the image or in the adjacent description. Do not use the OpenCode logo in a way
that implies endorsement. The current placeholder uses text only.
