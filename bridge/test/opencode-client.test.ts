import { describe, expect, it } from "vitest";
import { OpenCodeHttp } from "../src/opencode/client.js";

describe("OpenCodeHttp.events", () => {
  it("parses events split by both LF and CRLF boundaries", async () => {
    const sseBody = [
      'data: {"id":"evt_1","type":"session.idle","data":{"sessionID":"ses_1"}}\n\n',
      'data: {"id":"evt_2","type":"session.step.started","data":{"sessionID":"ses_1"}}\r\n\r\n',
      'data: {"id":"evt_3","type":"session.text.ended","data":{"sessionID":"ses_1"}}\n\n',
    ].join("");

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(sseBody));
              controller.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );

      const client = new OpenCodeHttp("http://127.0.0.1:4096", "pass");
      const events: Array<{ id: string; type: string }> = [];
      const controller = new AbortController();

      for await (const evt of client.events(controller.signal)) {
        events.push({ id: evt.id, type: evt.type });
      }

      expect(events).toEqual([
        { id: "evt_1", type: "session.idle" },
        { id: "evt_2", type: "session.step.started" },
        { id: "evt_3", type: "session.text.ended" },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
