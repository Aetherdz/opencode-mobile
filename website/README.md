# Website

Static landing page for OpenCode Mobile. It has no build step, no framework, no
external fonts, and no analytics.

## Local preview

From this directory:

```bash
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080`. The page works without JavaScript; JavaScript only
handles the mobile menu and the copy button.

From the repository root, `npm run check:site` verifies every local link,
asset, and fragment target in the HTML.

## Structure

| File | Purpose |
| --- | --- |
| `index.html` | Landing page |
| `404.html` | Static-host not-found page |
| `styles.css` | Design system and responsive layout |
| `app.js` | Mobile navigation, copy button, year |
| `assets/favicon.svg` | Neutral terminal-prompt mark |
| `assets/og.png` | 1200×630 social preview |

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

## Before launch

- Replace the placeholder repository links if the project moves.
- Set an absolute `og:image` URL after the final domain is known. Relative URLs
  work in browsers but some social scrapers require an absolute URL.
- Add a canonical URL after the domain is chosen.
- Add real screenshots if desired. The hero currently uses a CSS phone mockup so
  the page has no binary screenshot dependency.
- Verify the release links. They point to the GitHub Releases page and will
  return 404 until the first release exists.
- Keep the unofficial disclaimer visible in the header and footer.

## Design notes

The page is intentionally monochrome: paper background, black ink, one serif
display face, and a monospace technical layer. It avoids stock imagery and
external requests. Focus states, reduced motion, semantic headings, and a skip
link are included.

The site does not use cookies, localStorage, or third-party scripts.
