import fs from "node:fs";
import path from "node:path";
import type { LoggerLike } from "./log.js";

export interface PushTarget {
  token: string;
  platform: string;
  registeredAt: number;
}

interface ExpoTicket {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = process.env.EXPO_PUSH_URL ?? "https://exp.host/--/api/v2/push/send";
const COOLDOWN_MS = 15_000;

export class PushService {
  private readonly targets = new Map<string, PushTarget>();
  private readonly indexPath: string;
  private readonly lastSent = new Map<string, number>();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(
    dataDir: string,
    private readonly log: LoggerLike,
    private readonly enabled: boolean,
  ) {
    this.indexPath = path.join(dataDir, "push.json");
    this.load();
  }

  private load(): void {
    try {
      const raw = JSON.parse(fs.readFileSync(this.indexPath, "utf8")) as PushTarget[];
      for (const target of raw) this.targets.set(target.token, target);
    } catch {
      // first run
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      const temp = `${this.indexPath}.${process.pid}.tmp`;
      fs.writeFileSync(temp, JSON.stringify([...this.targets.values()], null, 2), { mode: 0o600 });
      fs.renameSync(temp, this.indexPath);
    }, 100);
    this.saveTimer.unref();
  }

  register(token: string, platform: string): void {
    this.targets.set(token, { token, platform, registeredAt: Date.now() });
    this.scheduleSave();
  }

  unregister(token: string): void {
    this.targets.delete(token);
    this.scheduleSave();
  }

  count(): number {
    return this.targets.size;
  }

  async send(
    key: string,
    title: string,
    body: string,
    data: Record<string, unknown> = {},
    force = false,
  ): Promise<{ sent: number; errors: string[] }> {
    if (!this.enabled || this.targets.size === 0) return { sent: 0, errors: [] };
    if (!force) {
      const last = this.lastSent.get(key) ?? 0;
      if (Date.now() - last < COOLDOWN_MS) return { sent: 0, errors: [] };
    }
    this.lastSent.set(key, Date.now());

    const tokens = [...this.targets.keys()];
    const errors: string[] = [];
    let sent = 0;
    for (let index = 0; index < tokens.length; index += 100) {
      const chunk = tokens.slice(index, index + 100);
      const messages = chunk.map((token) => ({
        to: token,
        title,
        body,
        data,
        sound: "default" as const,
      }));
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(messages),
          signal: AbortSignal.timeout(10_000),
        });
        const payload = (await response.json()) as { data?: ExpoTicket[] };
        const tickets = payload.data ?? [];
        tickets.forEach((ticket, ticketIndex) => {
          if (ticket.status === "ok") {
            sent += 1;
            return;
          }
          const token = chunk[ticketIndex];
          errors.push(`${token?.slice(0, 24) ?? "?"}: ${ticket.details?.error ?? ticket.message ?? "error"}`);
        });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "push request failed");
      }
    }
    if (errors.length > 0) {
      this.log.warn({ errors }, "expo push delivery reported errors");
    }
    return { sent, errors };
  }
}
