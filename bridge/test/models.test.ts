import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mapAvailableModels, OpenCodeAdapter, readConfiguredModels } from "../src/adapters/OpenCodeAdapter.js";

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

  it("reads configured models from opencode.json and includes Gemini 4 Argon", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-models-"));
    const configPath = path.join(tmpDir, "opencode.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        providers: {
          google: {
            name: "Google Gemini",
            models: {
              "antigravity-gemini-4-argon": {
                name: "Gemini 4 Argon (Antigravity)",
              },
            },
          },
        },
      }),
    );

    const models = readConfiguredModels([configPath]);
    expect(models).toEqual(
      expect.arrayContaining([
        {
          providerId: "google",
          modelId: "antigravity-gemini-4-argon",
          name: "Gemini 4 Argon (Antigravity)",
          providerName: "Google Gemini",
        },
      ]),
    );

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("falls back to configured models when upstream /api/model fails", async () => {
    const http = {
      request: async (_method: string, _path: string) => {
        throw new Error("Location plugins did not finish activating");
      },
    };
    const adapter = new OpenCodeAdapter(http as never);
    const models = await adapter.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((m) => m.modelId === "antigravity-gemini-4-argon")).toBe(true);
  });
});
