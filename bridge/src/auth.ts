import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

interface FailureRecord {
  count: number;
  firstAt: number;
  bannedUntil?: number;
}

export function constantTimeEqual(a: string, b: string): boolean {
  const left = crypto.createHash("sha256").update(a, "utf8").digest();
  const right = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(left, right);
}

export class AuthGuard {
  private readonly failures = new Map<string, FailureRecord>();
  private readonly wsTickets = new Map<string, number>();

  constructor(
    private readonly token: string,
    private readonly banAfter: number,
    private readonly banMs: number,
  ) {}

  issueWsTicket(ttlMs = 30_000): { ticket: string; expiresIn: number } {
    const ticket = crypto.randomBytes(32).toString("base64url");
    this.wsTickets.set(ticket, Date.now() + ttlMs);
    return { ticket, expiresIn: Math.ceil(ttlMs / 1000) };
  }

  consumeWsTicket(ticket: string | undefined): boolean {
    if (!ticket) return false;
    const expiresAt = this.wsTickets.get(ticket);
    if (!expiresAt) return false;
    this.wsTickets.delete(ticket);
    return expiresAt >= Date.now();
  }

  isBanned(key: string): boolean {
    const record = this.failures.get(key);
    if (!record?.bannedUntil) return false;
    if (record.bannedUntil > Date.now()) return true;
    this.failures.delete(key);
    return false;
  }

  check(token: string | undefined): boolean {
    if (!token) return false;
    return constantTimeEqual(token, this.token);
  }

  fail(key: string): void {
    const now = Date.now();
    const record = this.failures.get(key) ?? { count: 0, firstAt: now };
    if (now - record.firstAt > this.banMs) {
      record.count = 0;
      record.firstAt = now;
      record.bannedUntil = undefined;
    }
    record.count += 1;
    if (record.count >= this.banAfter) {
      record.bannedUntil = now + this.banMs;
    }
    this.failures.set(key, record);
  }

  reset(key: string): void {
    this.failures.delete(key);
  }

  prune(): void {
    const now = Date.now();
    for (const [key, record] of this.failures) {
      if (record.bannedUntil && record.bannedUntil <= now) this.failures.delete(key);
      else if (!record.bannedUntil && now - record.firstAt > this.banMs) this.failures.delete(key);
    }
    for (const [ticket, expiresAt] of this.wsTickets) {
      if (expiresAt <= now) this.wsTickets.delete(ticket);
    }
  }
}

export function bearerFromRequest(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  const direct = request.headers["x-auth-token"];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return undefined;
}

export function wsTicketFromRequest(request: FastifyRequest): string | undefined {
  if (request.routeOptions?.url !== "/ws") return undefined;
  const query = request.query as Record<string, unknown> | undefined;
  if (query && typeof query.ticket === "string") return query.ticket;
  return undefined;
}

function wsOriginAllowed(
  origin: string | undefined,
  host: string | undefined,
  allowedOrigins: string[],
): boolean {
  // Native clients do not send Origin. Browser clients must be same-origin or
  // explicitly allowlisted; this blocks cross-site WebSocket hijacking.
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function registerAuth(
  app: FastifyInstance,
  guard: AuthGuard,
  allowedOrigins: string[] = [],
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  setInterval(() => guard.prune(), 60_000).unref();

  return async (request, reply) => {
    const key = request.ip || "unknown";
    if (request.routeOptions?.url === "/ws") {
      if (!wsOriginAllowed(request.headers.origin, request.headers.host, allowedOrigins)) {
        reply.code(403).send({
          code: "origin_not_allowed",
          error: "origin_not_allowed",
          message: "WebSocket origin is not allowed.",
        });
        return;
      }
      if (guard.consumeWsTicket(wsTicketFromRequest(request))) {
        guard.reset(key);
        return;
      }
    }
    const token = bearerFromRequest(request);
    // A valid token always wins. This prevents an attacker (or a stale
    // client) from locking the owner out by burning failed attempts for an
    // IP that also holds the real token.
    if (guard.check(token)) {
      guard.reset(key);
      return;
    }
    if (guard.isBanned(key)) {
      reply.code(429).send({
        code: "banned",
        error: "banned",
        message: "Too many failed attempts. Try again later.",
      });
      return;
    }
    guard.fail(key);
    reply.code(401).send({
      code: "unauthorized",
      error: "unauthorized",
      message: "Missing or invalid token.",
    });
  };
}
