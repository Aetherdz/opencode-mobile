# Website

Static, multi-page site for OpenCode Mobile. It has no build step, no
framework, no external fonts, and no analytics. The only optional external
request is a cached GitHub API call for the repository star count.

Each topic is its own page so no single page is long. The home page is the
install page: commands with a copy button, the prerequisites, and the
download.

## Local preview

From this directory:

```bash
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080`. The page works without JavaScript; JavaScript
handles the mobile menu, the copy buttons, the year, the cached star count,
and the active-section marker in the page sidebar.

From the repository root, `npm run check:site` verifies every local link,
asset, and fragment target in the HTML, including the pages in subdirectories.

## Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Home: install commands, prerequisites, download, links to the rest |
| `features/index.html` | What the client does, and where it runs |
| `guide/index.html` | Quick start, configuration table, remote access |
| `security/index.html` | Trust boundaries, controls, deployment checklist |
| `faq/index.html` | Short answers to the common questions |
| `docs/index.html` | Index of every page and repository document |
| `404.html` | Static-host not-found page |
| `styles.css` | Design system and responsive layout |
| `app.js` | Mobile navigation, copy buttons, year, cached star count, page sidebar |
| `assets/favicon.svg` | Neutral terminal-prompt mark |
| `assets/og.png` | 1200×630 social preview |
| `../.github/social-preview.png` | 1280×640 GitHub social preview; upload it manually in repository settings |

Pages live in directories so the URLs stay clean (`/features/`). All links are
relative, so the site works from a subdirectory as well as a domain root. The
`404.html` page is the exception: it uses absolute URLs because a static host
can serve it from any path.

## Deployment

### GitHub Pages

The repository includes `.github/workflows/pages.yml`. Enable Pages with
**Source: GitHub Actions**, then push to `main` or run the workflow manually.
The workflow publishes this directory as-is.

### Cloudflare Pages / Netlify

- Build command: none.
- Output directory: `website`.
- No environment variables are required.

### Any static host

Copy the contents of this directory to the web root. The page uses relative
paths, so it works from a subdirectory as well as a domain root.

## Maintenance

- Update the repository and release links if the project moves.
- Keep the version, APK file name, and SHA-256 in `index.html` in sync with the
  latest release.
- Set an absolute `og:image` URL if a custom domain replaces GitHub Pages.
- Add a canonical URL if a custom domain is chosen.
- Keep README screenshots captured from the Expo app, not hand-drawn approximations.
- Verify the release links after each release.
- Keep the unofficial disclaimer visible in the header and footer.
- Upload `.github/social-preview.png` in **Settings → General → Social preview**.
- Keep every page short. If a page grows past one screen of reading, split it
  and add it to the sidebar of the sibling pages.

## Design notes

The pages are intentionally monochrome: paper background, black ink, one serif
display face, and a monospace technical layer. They avoid stock imagery and
third-party scripts. Focus states, reduced motion, semantic headings, and a skip
link are included. The documentation pages use a sticky sidebar with the page
sections and a "on this page" marker that follows the scroll position.

The site does not use cookies, analytics, or third-party scripts. It stores only
the star count and its timestamp in `localStorage` for 24 hours, and backs off
for an hour when GitHub answers `403` or `429`; the GitHub request uses
`credentials: "omit"` and `referrerPolicy: "no-referrer"`.
