import { describe, expect, it } from "vitest";
import { mapAvailableModels, OpenCodeAdapter } from "../src/adapters/OpenCodeAdapter.js";

describe("available model mapping", () => {
  it("keeps enabled models and exposes only safe display fields", () => {
    const result = mapAvailableModels(
      [
        {
          providerID: "p1",
          modelID: "m1",
          name: "Model One",
          enabled: true,
          headers: { authorization: "secret" },
          settings: { baseURL: "https://private.example" },
        },
        { providerID: "p1", modelID: "m2", name: "Disabled", enabled: false },
        { providerID: "p2", modelID: "m3", name: "Malformed", enabled: true },
      ],
      [{ id: "p1", name: "Provider One", headers: { token: "secret" } }],
    );

    expect(result).toEqual([
      { providerId: "p1", modelId: "m1", name: "Model One", providerName: "Provider One" },
      { providerId: "p2", modelId: "m3", name: "Malformed", providerName: "p2" },
    ]);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("baseURL");
  });

  it("adds the selected provider/model identifiers to the upstream prompt body", async () => {
    let sentBody: unknown;
    const http = {
      request: async (_method: string, _path: string, body?: unknown) => {
        sentBody = body;
        return { data: { id: "msg_1" } };
      },
    };
    const adapter = new OpenCodeAdapter(http as never);
    await adapter.sendPrompt("ses_1", {
      text: "Hello",
      model: { providerID: "lumosel", modelID: "claude-sonnet-5" },
    });
    expect(sentBody).toMatchObject({
      text: "Hello",
      model: { providerID: "lumosel", modelID: "claude-sonnet-5" },
    });
  });
});
