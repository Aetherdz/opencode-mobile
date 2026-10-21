import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";

const base = `http://127.0.0.1:${process.env.PORT ?? "8787"}`;
const token = process.env.AUTH_TOKEN;
if (!token) {
  console.error("AUTH_TOKEN is missing");
  process.exit(1);
}

const headers = { authorization: `Bearer ${token}` };

async function api<T>(method: string, pathName: string, body?: unknown): Promise<T> {
  const response = await fetch(base + pathName, {
    method,
    headers: {
      ...headers,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${pathName} -> ${response.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

const workdir = path.join(os.homedir(), "opencode-mobile", "bridge", ".smoke");
fs.mkdirSync(workdir, { recursive: true });

const sessions = await api<{ data: Array<{ id: string; title: string; source: string }> }>("GET", "/sessions");
console.log(`sessions: ${sessions.data.length}`);
console.log(
  sessions.data
    .slice(0, 5)
    .map((session) => `  ${session.id} [${session.source}] ${session.title}`)
    .join("\n"),
);

const created = await api<{ data: { id: string } }>("POST", "/sessions", {
  directory: workdir,
  title: `smoke ${new Date().toISOString()}`,
});
const sessionId = created.data.id;
console.log(`created: ${sessionId}`);

const ws = new WebSocket(`ws://127.0.0.1:${process.env.PORT ?? "8787"}/ws?token=${encodeURIComponent(token)}`);
let text = "";
let idleResolve: (() => void) | null = null;

const done = new Promise<void>((resolve) => {
  idleResolve = resolve;
});

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "subscribe", sessionId }));
  ws.send(
    JSON.stringify({
      type: "message.send",
      sessionId,
      text: "Reply with exactly: bridge-ok",
      delivery: "queue",
    }),
  );
});

ws.on("message", (raw) => {
  const event = JSON.parse(raw.toString()) as {
    type: string;
    eventId?: string;
    delta?: string;
    status?: string;
    message?: string;
    messageId?: string;
  };
  if (event.type === "output.chunk" && event.delta) text += event.delta;
  if (event.type === "status") console.log(`status: ${event.status}`);
  if (event.type === "status" && event.status === "idle" && text) idleResolve?.();
  if (event.type === "error") console.log(`error: ${event.message}`);
});

await Promise.race([done, new Promise((resolve) => setTimeout(resolve, 20_000))]);
ws.close();
console.log(`assistant text: ${JSON.stringify(text)}`);
if (!text.includes("bridge-ok")) {
  console.error("smoke failed: expected bridge-ok in the streamed reply");
  process.exit(1);
}
console.log("smoke ok");
process.exit(0);
