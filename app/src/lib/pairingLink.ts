export interface PairingDetails {
  url: string;
  token: string;
}

const MIN_TOKEN_LENGTH = 32;

/** Parse an untrusted app-link/QR payload. Credentials are only returned to the
 * caller for manual confirmation; this helper never persists or logs them. */
export function parsePairingLink(raw: string): PairingDetails | null {
  try {
    const link = new URL(raw);
    if (
      link.protocol !== 'opencode-mobile:' ||
      link.hostname !== 'connect' ||
      (link.pathname !== '' && link.pathname !== '/') ||
      link.hash ||
      [...link.searchParams.keys()].some((key) => key !== 'url' && key !== 'token')
    ) return null;

    const urls = link.searchParams.getAll('url');
    const tokens = link.searchParams.getAll('token');
    if (urls.length !== 1 || tokens.length !== 1) return null;

    const endpoint = new URL(urls[0]);
    if (
      (endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') ||
      !endpoint.hostname ||
      endpoint.username ||
      endpoint.password ||
      /[\s\u0000-\u001f]/.test(urls[0]) ||
      tokens[0].length < MIN_TOKEN_LENGTH ||
      /[\s\u0000-\u001f]/.test(tokens[0])
    ) return null;

    return { url: urls[0], token: tokens[0] };
  } catch {
    return null;
  }
}
