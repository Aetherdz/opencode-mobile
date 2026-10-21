# Design

OpenCode Mobile is a chat-first client. The design is monochrome, dark-first,
and intentionally quiet: the agent's answer is the content, not the chrome.

## Principles

1. **One primary action per screen.** Connect, compose, answer, or approve.
2. **No color signals.** Status is conveyed with text, weight, icons, and
   spacing. The palette is black, white, and neutral grays in both themes.
3. **No tabs or drawer.** Sessions → Chat → Diff, with Settings in the Sessions
   header. Tool work is summarized in chat instead of exposed as a terminal.
4. **Touch first.** Minimum target 44 pt, 20 px icons on the standard rhythm,
   and a composer that stays reachable above the keyboard.
5. **Bilingual by construction.** Arabic and English share the same layout;
   text direction is resolved per string, not per app.

## Type

| Role | Font | Size / line | Weight |
| --- | --- | --- | --- |
| Sessions title | Inter / Noto Sans Arabic | 34 / 39 | 700 |
| Connect title | Inter / Noto Sans Arabic | 30 / 36 | 700 |
| Top bar title | Inter / Noto Sans Arabic | 16 / 21 | 600 |
| Body | Inter / Noto Sans Arabic | 15–16 / 22–24 | 400 |
| Button / field label | Inter / Noto Sans Arabic | 15 / 20 | 500 |
| Meta / helper | Inter / Noto Sans Arabic | 13 / 18 | 400 |
| Caption | Inter / Noto Sans Arabic | 12 / 16 | 400 |
| Section label | Inter / Noto Sans Arabic | 12 / 14 | 600, 1.44 tracking, uppercase |
| Code | JetBrains Mono | 13 / 20 | 400 |

Arabic strings use Noto Sans Arabic. Mixed-direction messages use the first
strong directional character to choose alignment. Code, paths, commands, and
diffs stay left-to-right inside a right-to-left layout.

## Color

The theme has two palettes with the same roles. The redesign palette is the
source of truth for new screens:

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `bg` | `#000000` | `#FFFFFF` | Page background. |
| `surface` | `#0D0D0D` | `#F5F5F5` | Cards and grouped rows. |
| `raised` | `#161616` | `#EBEBEB` | Sheets, popovers, pressed rows. |
| `border` | `#2A2A2A` | `#D4D4D4` | Hairlines and control borders. |
| `divider` | `#1C1C1C` | `#E6E6E6` | Section separators. |
| `textStrong` | `#FFFFFF` | `#000000` | Titles and primary text. |
| `secondary` | `#A0A0A0` | `#5F5F5F` | Metadata and previews. |
| `placeholder` | `#8A8A8A` | `#707070` | Empty fields. |
| `primary` | `#FFFFFF` | `#000000` | Primary button fill. |
| `onPrimary` | `#000000` | `#FFFFFF` | Primary button label. |

There is no red/green success or error color in the redesign palette. Errors use
the `danger` role (`#FFFFFF` dark, `#0A0A0A` light), an icon, and explicit text.
Do not add a new accent color without updating the tokens and both themes.

## Layout

- Spacing follows a 4 pt scale: `2, 4, 8, 12, 16, 24, 32, 48, 64`.
- Radii: `4, 8, 12, 16, 18` for bubbles, `20` for the composer, `999` for pills.
- Icons: `16, 20, 24, 28, 32`; the default is 20.
- Session rows: title, one-line preview, relative time, and a status label.
  No cards, no colored badges.
- Chat: user messages align to the reading edge; assistant messages are full
  width. Tool activity is a compact row with a status label. Diffs open from the
  overflow menu, not a tab.
- Composer: multiline text, attachment action, send/stop action, and a hint row.
  It must not be covered by the keyboard or the home indicator.

## Screens

| Screen | Main content | Empty / error state |
| --- | --- | --- |
| Connect | URL, token, connect action, security note. | Inline validation and a retry action. |
| Sessions | Search, grouped list, new-session action, settings. | "No sessions" with a create action. |
| New session | Workdir picker, optional title, create. | Disabled action until a workdir is chosen. |
| Chat | Transcript, streaming answer, activities, composer. | Retry banner when disconnected. |
| Question card | Header, question, options, custom answer. | Submit disabled until required fields are valid. |
| Approval sheet | Action, resources, risk note, once/always/reject. | Destructive actions require confirmation. |
| Settings | Theme, language, connection, notifications, about. | Version and bridge status. |

## Motion

- Use opacity and translation, not scale bounce.
- Streaming text should not animate each token; append and keep the scroll
  position stable unless the user is at the bottom.
- Haptics are reserved for send, approval, and destructive confirmation.
- Respect the OS reduced-motion setting.

## Accessibility

- Every icon-only control has an accessible label.
- Status is never conveyed by color alone.
- Body text respects the OS font scale; code blocks may scroll horizontally.
- The composer and primary actions stay reachable with a screen reader.
- Test Arabic and English at 100% and 130% font scale.
- Do not place critical text over the scrim without enough contrast.

## Current state

The redesign tokens and screens are implemented. Device QA is still pending for
keyboard behavior, font scaling, RTL edge cases, and dark/light switching. The
screenshots in `docs/images/` are placeholders until that pass is complete.
