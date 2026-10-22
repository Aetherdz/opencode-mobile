import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { AuthGuard, bearerFromRequest, registerAuth } from "../src/auth.js";

const TOKEN = "t".repeat(40);

function request(
  headers: Record<string, string | undefined>,
  query: Record<string, unknown> = {},
  routeUrl?: string,
): FastifyRequest {
  return { headers, query, routeOptions: routeUrl ? { url: routeUrl } : undefined } as unknown as FastifyRequest;
}

const apps: FastifyInstance[] = [];

function buildApp(guard: AuthGuard): FastifyInstance {
  const app = Fastify();
  app.addHook("preHandler", registerAuth(app, guard));
  app.get("/protected", async () => ({ ok: true }));
  apps.push(app);
  return app;
}

afterEach(async () => {
  while (apps.length > 0) {
    const app = apps.pop();
    if (app) await app.close();
  }
});

describe("bearerFromRequest", () => {
  it("extracts the token from Authorization and x-auth-token on any route", () => {
    expect(bearerFromRequest(request({ authorization: "Bearer abc123" }))).toBe("abc123");
    expect(bearerFromRequest(request({ "x-auth-token": "  xyz789  " }))).toBe("xyz789");
  });

  it("never accepts the bearer token in a query string", () => {
    expect(bearerFromRequest(request({}, { token: "query-token" }, "/ws"))).toBeUndefined();
    expect(bearerFromRequest(request({}, { token: "query-token" }, "/protected"))).toBeUndefined();
    expect(bearerFromRequest(request({}, { token: "query-token" }))).toBeUndefined();
  });

  it("prefers Authorization and ignores unsupported headers or non-string query tokens", () => {
    expect(
      bearerFromRequest(
        request({ authorization: "Bearer first", "x-auth-token": "second" }, { token: "third" }, "/ws"),
      ),
    ).toBe("first");
    expect(bearerFromRequest(request({ authorization: "Basic abc" }))).toBeUndefined();
    expect(bearerFromRequest(request({ "x-auth-token": "   " }))).toBeUndefined();
    expect(bearerFromRequest(request({}, { token: 42 }, "/ws"))).toBeUndefined();
  });
});

describe("registerAuth", () => {
  it("returns 401 without a token and 200 with header tokens", async () => {
    const app = buildApp(new AuthGuard(TOKEN, 10, 60_000));

    const unauthorized = await app.inject({ method: "GET", url: "/protected" });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.json()).toMatchObject({ error: "unauthorized" });

    const bearer = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(bearer.statusCode).toBe(200);

    const header = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { "x-auth-token": TOKEN },
    });
    expect(header.statusCode).toBe(200);

    const query = await app.inject({
      method: "GET",
      url: `/protected?token=${TOKEN}`,
    });
    expect(query.statusCode).toBe(401);
  });

  it("authenticates before the JSON body is parsed", async () => {
    const app = Fastify();
    app.addHook("onRequest", registerAuth(app, new AuthGuard(TOKEN, 10, 60_000)));
    app.post("/protected", async () => ({ ok: true }));
    apps.push(app);

    const unauthorized = await app.inject({
      method: "POST",
      url: "/protected",
      headers: { "content-type": "application/json" },
      payload: "not-json",
    });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.json()).toMatchObject({ error: "unauthorized" });
  });

  it("bans repeated bad tokens but still accepts the real token", async () => {
    const app = buildApp(new AuthGuard(TOKEN, 2, 60_000));

    const first = await app.inject({ method: "GET", url: "/protected" });
    expect(first.statusCode).toBe(401);

    const second = await app.inject({ method: "GET", url: "/protected" });
    expect(second.statusCode).toBe(401);

    const banned = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer wrong" },
    });
    expect(banned.statusCode).toBe(429);
    expect(banned.json()).toMatchObject({ error: "banned" });

    // A valid token always wins, so an attacker cannot lock the owner out.
    const owner = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(owner.statusCode).toBe(200);
  });

  it("accepts a WebSocket ticket once and rejects replay and wrong origins", async () => {
    const guard = new AuthGuard(TOKEN, 10, 60_000);
    const app = Fastify();
    const auth = registerAuth(app, guard, ["https://app.example"]);
    app.get("/ws", { preValidation: auth }, async () => ({ ok: true }));
    apps.push(app);

    const { ticket } = guard.issueWsTicket();
    const first = await app.inject({
      method: "GET",
      url: `/ws?ticket=${encodeURIComponent(ticket)}`,
      headers: { origin: "https://app.example" },
    });
    expect(first.statusCode).toBe(200);

    const replay = await app.inject({
      method: "GET",
      url: `/ws?ticket=${encodeURIComponent(ticket)}`,
      headers: { origin: "https://app.example" },
    });
    expect(replay.statusCode).toBe(401);

    const badOriginTicket = guard.issueWsTicket().ticket;
    const badOrigin = await app.inject({
      method: "GET",
      url: `/ws?ticket=${encodeURIComponent(badOriginTicket)}`,
      headers: { origin: "https://evil.example" },
    });
    expect(badOrigin.statusCode).toBe(403);
    expect(badOrigin.json()).toMatchObject({ error: "origin_not_allowed" });
  });
});
