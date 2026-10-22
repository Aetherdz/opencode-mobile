# Website

Static landing page for OpenCode Mobile. It has no build step, no framework, no
external fonts, and no analytics. The only optional external request is a cached
GitHub API call for the repository star count.

## Local preview

From this directory:

```bash
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080`. The page works without JavaScript; JavaScript
handles the mobile menu, the copy button, the year, and the cached star count.

From the repository root, `npm run check:site` verifies every local link,
asset, and fragment target in the HTML.

## Structure

| File | Purpose |
| --- | --- |
| `index.html` | Landing page |
| `404.html` | Static-host not-found page |
| `styles.css` | Design system and responsive layout |
| `app.js` | Mobile navigation, copy button, year, cached star count |
| `assets/favicon.svg` | Neutral terminal-prompt mark |
| `assets/og.png` | 1200×630 social preview |
| `../.github/social-preview.png` | 1280×640 GitHub social preview; upload it manually in repository settings |

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
- Set an absolute `og:image` URL if a custom domain replaces GitHub Pages.
- Add a canonical URL if a custom domain is chosen.
- Replace the CSS phone mockup with real captures when the screenshot harness
  lands.
- Verify the release links after each release.
- Keep the unofficial disclaimer visible in the header and footer.
- Upload `.github/social-preview.png` in **Settings → General → Social preview**.

## Design notes

The page is intentionally monochrome: paper background, black ink, one serif
display face, and a monospace technical layer. It avoids stock imagery and
third-party scripts. Focus states, reduced motion, semantic headings, and a skip
link are included.

The site does not use cookies, analytics, or third-party scripts. It stores only
the star count and its timestamp in `localStorage` for six hours; the GitHub
request uses `credentials: "omit"` and `referrerPolicy: "no-referrer"`.
