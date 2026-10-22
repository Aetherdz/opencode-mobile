import type { FastifyInstance } from "fastify";

const ALLOWED_METHODS = "GET,POST,PATCH,DELETE,OPTIONS";
const ALLOWED_HEADERS = "authorization,content-type,x-auth-token";

/**
 * Add an exact-origin CORS policy. This is intentionally opt-in: an empty
 * allowlist leaves the bridge without CORS headers, which keeps the default
 * deployment unusable from arbitrary browser pages.
 *
 * Preflight requests are answered before the authentication hook. Actual
 * requests still require the bearer token. CORS controls browser reads; it is
 * not authentication.
 */
export function registerCors(app: FastifyInstance, origins: string[]): void {
  const allowed = new Set(origins);

  app.addHook("onRequest", (request, reply, done) => {
    const origin = request.headers.origin;
    if (!origin) {
      done();
      return;
    }

    // Any response that depends on Origin must not be cached for another one.
    reply.header("vary", "Origin");

    if (!allowed.has(origin)) {
      // A disallowed preflight gets a valid empty response with no CORS
      // headers, so the browser blocks the real request without exposing the
      // authentication layer to unauthenticated preflight traffic.
      if (request.method === "OPTIONS") {
        reply.code(204).send();
        return;
      }
      done();
      return;
    }

    reply.header("access-control-allow-origin", origin);

    if (request.method === "OPTIONS") {
      reply.header("access-control-allow-methods", ALLOWED_METHODS);
      reply.header("access-control-allow-headers", ALLOWED_HEADERS);
      reply.header("access-control-max-age", "600");
      if (request.headers["access-control-request-private-network"] === "true") {
        reply.header("access-control-allow-private-network", "true");
      }
      reply.code(204).send();
      return;
    }

    done();
  });
}
