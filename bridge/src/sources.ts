import type { BackendAdapter } from "./adapters/BackendAdapter.js";
import type { RuntimeState } from "./state.js";
import type { RawMessage, SessionSource } from "./types.js";

export class SourceResolver {
  private readonly cache = new Map<string, { at: number; source: SessionSource }>();

  constructor(
    private readonly adapter: BackendAdapter,
    private readonly state: RuntimeState,
    private readonly ttlMs = 120_000,
  ) {}

  async resolve(sessionId: string): Promise<SessionSource> {
    const known = this.state.sourceOf(sessionId);
    if (known !== "unknown") return known;

    const cached = this.cache.get(sessionId);
    if (cached && Date.now() - cached.at < this.ttlMs) return cached.source;

    try {
      const page = await this.adapter.listMessages(sessionId, { limit: 20, order: "desc" });
      this.state.noteFromMessages(
        sessionId,
        page.data as Array<{ metadata?: Record<string, unknown> }>,
      );
    } catch {
      // ignore; unknown is acceptable
    }
    const source = this.state.sourceOf(sessionId);
    this.cache.set(sessionId, { at: Date.now(), source });
    return source;
  }
}
