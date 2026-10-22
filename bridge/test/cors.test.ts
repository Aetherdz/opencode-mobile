import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerCors } from "../src/cors.js";

const TOKEN = "t".repeat(40);
const ALLOWED = "http://localhost:8081";
const apps: FastifyInstance[] = [];
let authCalls = 0;

function buildApp(origins: string[]): FastifyInstance {
  authCalls = 0;
  const app = Fastify();
  registerCors(app, origins);
  app.addHook("preHandler", async (request, reply) => {
    authCalls += 1;
    if (request.headers.authorization !== `Bearer ${TOKEN}`) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });
  app.get("/sessions", async () => ({ ok: true }));
  app.post("/sessions", async () => ({ ok: true }));
  apps.push(app);
  return app;
}

afterEach(async () => {
  while (apps.length > 0) {
    const app = apps.pop();
    if (app) await app.close();
  }
});

describe("registerCors", () => {
  it("answers an allowed preflight before authentication", async () => {
    const app = buildApp([ALLOWED]);
    const response = await app.inject({
      method: "OPTIONS",
      url: "/sessions",
      headers: {
        origin: ALLOWED,
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(response.headers["access-control-allow-methods"]).toContain("GET");
    expect(response.headers["access-control-allow-headers"]).toContain("authorization");
    expect(response.headers["access-control-max-age"]).toBe("600");
    expect(response.headers.vary).toBe("Origin");
    expect(authCalls).toBe(0);
  });

  it("adds the allowed origin to authenticated and error responses", async () => {
    const app = buildApp([ALLOWED]);
    const unauthorized = await app.inject({
      method: "GET",
      url: "/sessions",
      headers: { origin: ALLOWED },
    });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.headers["access-control-allow-origin"]).toBe(ALLOWED);

    const authorized = await app.inject({
      method: "GET",
      url: "/sessions",
      headers: { origin: ALLOWED, authorization: `Bearer ${TOKEN}` },
    });
    expect(authorized.statusCode).toBe(200);
    expect(authorized.headers["access-control-allow-origin"]).toBe(ALLOWED);
  });

  it("does not reflect a disallowed origin and still runs authentication", async () => {
    const app = buildApp([ALLOWED]);
    const response = await app.inject({
      method: "GET",
      url: "/sessions",
      headers: { origin: "https://evil.example", authorization: `Bearer ${TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers.vary).toBe("Origin");
    expect(authCalls).toBe(1);
  });

  it("answers a disallowed preflight without CORS headers or authentication", async () => {
    const app = buildApp([ALLOWED]);
    const response = await app.inject({
      method: "OPTIONS",
      url: "/sessions",
      headers: {
        origin: "https://evil.example",
        "access-control-request-method": "POST",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(authCalls).toBe(0);
  });

  it("leaves requests without an Origin header unchanged", async () => {
    const app = buildApp([ALLOWED]);
    const response = await app.inject({
      method: "GET",
      url: "/sessions",
      headers: { authorization: `Bearer ${TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers.vary).toBeUndefined();
  });

  it("is disabled when the allowlist is empty", async () => {
    const app = buildApp([]);
    const response = await app.inject({
      method: "OPTIONS",
      url: "/sessions",
      headers: { origin: ALLOWED, "access-control-request-method": "GET" },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows a private-network preflight only for an allowed origin", async () => {
    const app = buildApp([ALLOWED]);
    const allowed = await app.inject({
      method: "OPTIONS",
      url: "/sessions",
      headers: {
        origin: ALLOWED,
        "access-control-request-method": "GET",
        "access-control-request-private-network": "true",
      },
    });
    expect(allowed.headers["access-control-allow-private-network"]).toBe("true");

    const denied = await app.inject({
      method: "OPTIONS",
      url: "/sessions",
      headers: {
        origin: "https://evil.example",
        "access-control-request-method": "GET",
        "access-control-request-private-network": "true",
      },
    });
    expect(denied.headers["access-control-allow-private-network"]).toBeUndefined();
  });
});
