export interface PairingDetails {
  url: string;
  token: string;
}

const MIN_TOKEN_LENGTH = 32;

function isValidEndpoint(rawUrl: string): boolean {
  try {
    const endpoint = new URL(rawUrl);
    return (
      (endpoint.protocol === 'https:' || endpoint.protocol === 'http:') &&
      Boolean(endpoint.hostname) &&
      !endpoint.username &&
      !endpoint.password &&
      !/[\s\u0000-\u001f]/.test(rawUrl)
    );
  } catch {
    return false;
  }
}

function isValidToken(rawToken: string): boolean {
  return (
    typeof rawToken === 'string' &&
    rawToken.length >= MIN_TOKEN_LENGTH &&
    !/[\s\u0000-\u001f]/.test(rawToken)
  );
}

/** Parse an untrusted app-link/QR payload or clipboard content. */
export function parsePairingLink(raw: string): PairingDetails | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // 1. JSON payload: {"url":"...","token":"..."}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const u = typeof parsed.url === 'string' ? parsed.url.trim() : '';
      const t = typeof parsed.token === 'string' ? parsed.token.trim() : '';
      if (isValidEndpoint(u) && isValidToken(t)) {
        return { url: u, token: t };
      }
    } catch {
      // Fall through
    }
  }

  // 2. Deep link scheme: opencode-mobile://connect?url=...&token=...
  try {
    const link = new URL(trimmed);
    if (
      link.protocol === 'opencode-mobile:' &&
      link.hostname === 'connect' &&
      (link.pathname === '' || link.pathname === '/') &&
      !link.hash
    ) {
      const urls = link.searchParams.getAll('url');
      const tokens = link.searchParams.getAll('token');
      if (urls.length === 1 && tokens.length === 1) {
        const u = urls[0].trim();
        const t = tokens[0].trim();
        if (isValidEndpoint(u) && isValidToken(t)) {
          return { url: u, token: t };
        }
      }
    }
  } catch {
    // Fall through
  }

  // 3. Plain text with URL and Token (e.g., copied from terminal output)
  const urlMatch = /(https?:\/\/[^\s"'<>]+)/i.exec(trimmed);
  const tokenMatch = /(?:token[:=\s]+)?([a-zA-Z0-9_-]{32,})/i.exec(trimmed);
  if (urlMatch && tokenMatch) {
    const u = urlMatch[1].trim();
    const t = tokenMatch[1].trim();
    if (isValidEndpoint(u) && isValidToken(t) && u !== t) {
      return { url: u, token: t };
    }
  }

  return null;
}
