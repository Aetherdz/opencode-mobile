import { describe, expect, it } from "vitest";
import { buildFormAnswer, mapMessage, mapQuestion, toolActivity } from "../src/mapping.js";
import type {
  RawAssistantMessage,
  RawForm,
  RawUserMessage,
} from "../src/types.js";

describe("mapMessage user messages", () => {
  it("maps source metadata and resolves file:// attachments through the callback", () => {
    const resolved: Array<{ path: string; name: string; mime: string }> = [];
    const raw: RawUserMessage = {
      id: "msg_user",
      type: "user",
      text: "please review this",
      time: { created: 100 },
      metadata: { source: "telegram" },
      files: [
        {
          name: "notes.md",
          mime: "text/markdown",
          source: { type: "uri", uri: "file:///tmp/work/notes%20one.md" },
        },
        {
          name: "inline.txt",
          mime: "text/plain",
          data: "aGVsbG8=",
          source: { type: "inline" },
        },
      ],
    };

    const mapped = mapMessage(raw, "ses_1", (filePath, name, mime) => {
      resolved.push({ path: filePath, name, mime });
      return { id: "fil_1", name, mime, size: 4, url: "/files/fil_1" };
    });

    expect(mapped).toMatchObject({
      id: "msg_user",
      sessionId: "ses_1",
      role: "user",
      text: "please review this",
      source: "telegram",
      status: "done",
    });
    expect(resolved).toEqual([
      { path: "/tmp/work/notes one.md", name: "notes.md", mime: "text/markdown" },
    ]);
    expect(mapped?.files).toEqual([
      { id: "fil_1", name: "notes.md", mime: "text/markdown", size: 4, url: "/files/fil_1" },
    ]);
  });

  it("omits source and files when metadata is absent and the resolver declines", () => {
    const raw: RawUserMessage = {
      id: "msg_plain",
      type: "user",
      text: "hello",
      time: { created: 101 },
    };

    const mapped = mapMessage(raw, "ses_1", () => null);
    expect(mapped).not.toHaveProperty("source");
    expect(mapped).not.toHaveProperty("files");
    expect(mapped?.text).toBe("hello");
  });
});

describe("mapMessage assistant messages", () => {
  it("joins text parts and converts tool parts into activities", () => {
    const raw: RawAssistantMessage = {
      id: "msg_assistant",
      type: "assistant",
      time: { created: 102, completed: 103 },
      content: [
        { type: "text", text: "Running " },
        {
          type: "tool",
          id: "tool_1",
          name: "bash",
          state: {
            status: "completed",
            input: { command: "npm test" },
            content: [],
            metadata: { title: "Run tests" },
          },
          time: { created: 102 },
        },
        { type: "reasoning", text: "thinking" },
        { type: "text", text: "done" },
      ],
    };

    const mapped = mapMessage(raw, "ses_1", () => null);

    expect(mapped?.text).toBe("Running done");
    expect(mapped?.status).toBe("done");
    expect(mapped?.activities).toEqual([
      {
        id: "tool_1",
        name: "bash",
        title: "Run tests",
        status: "done",
        detail: "npm test",
      },
    ]);
  });

  it("marks an assistant message without a completion time as streaming", () => {
    const raw: RawAssistantMessage = {
      id: "msg_streaming",
      type: "assistant",
      time: { created: 104 },
      content: [{ type: "text", text: "partial" }],
    };

    const mapped = mapMessage(raw, "ses_1", () => null);
    expect(mapped?.status).toBe("streaming");
    expect(mapped?.text).toBe("partial");
  });

  it("maps a string error into a structured agent error", () => {
    const raw: RawAssistantMessage = {
      id: "msg_error",
      type: "assistant",
      time: { created: 105 },
      content: [],
      error: "Provider authentication failed",
    };

    const mapped = mapMessage(raw, "ses_1", () => null);
    expect(mapped?.status).toBe("error");
    expect(mapped?.text).toBe("");
    expect(mapped?.error).toEqual({ message: "Provider authentication failed" });
  });

  it("extracts code, status and response body from an API error object", () => {
    const raw: RawAssistantMessage = {
      id: "msg_api_error",
      type: "assistant",
      time: { created: 106 },
      content: [{ type: "text", text: "before failure" }],
      error: {
        name: "APIError",
        data: {
          message: "Unauthorized",
          statusCode: 401,
          responseBody: '{"error":"invalid api key"}',
        },
      },
    };

    const mapped = mapMessage(raw, "ses_1", () => null);
    expect(mapped?.status).toBe("error");
    expect(mapped?.text).toBe("before failure");
    expect(mapped?.error).toMatchObject({
      message: "Unauthorized",
      code: "APIError",
    });
    expect(mapped?.error?.detail).toContain("HTTP 401");
    expect(mapped?.error?.detail).toContain("invalid api key");
  });
});

describe("mapQuestion", () => {
  const form: RawForm = {
    id: "frm_1",
    sessionID: "ses_1",
    title: "Questions",
    metadata: { kind: "question", tool: { messageID: "msg_1", id: "call_1" } },
    fields: [
      {
        key: "q0",
        type: "string",
        title: "Approach",
        description: "How should I proceed?",
        required: true,
        options: [
          { value: "build", label: "Build", description: "Write code" },
          { value: "plan", label: "Plan" },
        ],
        custom: true,
      },
      {
        key: "q1",
        type: "multiselect",
        title: "Checks",
        required: false,
        options: [{ value: "tests", label: "Tests" }],
        minItems: 0,
      },
      { key: "hidden", type: "string", hidden: true },
      { key: "number", type: "integer" },
    ],
  };

  it("normalizes question forms and ignores unsupported fields", () => {
    expect(mapQuestion(form, 123)).toEqual({
      id: "frm_1",
      sessionId: "ses_1",
      title: "Questions",
      createdAt: 123,
      questions: [
        {
          id: "q0",
          header: "Approach",
          question: "How should I proceed?",
          multiple: false,
          required: true,
          allowCustom: true,
          options: [
            { value: "build", label: "Build", description: "Write code" },
            { value: "plan", label: "Plan" },
          ],
        },
        {
          id: "q1",
          header: "Checks",
          question: "Checks",
          multiple: true,
          required: false,
          allowCustom: false,
          options: [{ value: "tests", label: "Tests" }],
          minItems: 0,
        },
      ],
    });
  });

  it("rejects non-question forms", () => {
    expect(mapQuestion({ ...form, metadata: { kind: "other" } })).toBeNull();
  });

  it("builds form answers using scalar and array values", () => {
    const question = mapQuestion(form);
    expect(question).not.toBeNull();
    if (!question) return;
    expect(
      buildFormAnswer(question, [["build"], ["tests", "lint"]]),
    ).toEqual({ q0: "build", q1: ["tests", "lint"] });
  });
});

describe("toolActivity", () => {
  it("maps completed, error and running states", () => {
    expect(
      toolActivity({
        id: "t1",
        name: "bash",
        state: { status: "completed", input: { command: "npm test" } },
      }).status,
    ).toBe("done");
    expect(
      toolActivity({
        id: "t2",
        name: "bash",
        state: { status: "error", input: { command: "false" } },
      }).status,
    ).toBe("error");
    expect(
      toolActivity({
        id: "t3",
        name: "bash",
        state: { status: "running", input: { command: "sleep 1" } },
      }).status,
    ).toBe("running");
  });

  it("prefers metadata.title and collects command, path and pattern into detail", () => {
    const activity = toolActivity({
      id: "t4",
      name: "grep",
      state: {
        status: "completed",
        input: { command: "rg foo", path: "/tmp/src", pattern: "foo" },
        metadata: { title: "Search source" },
      },
    });

    expect(activity).toMatchObject({
      id: "t4",
      name: "grep",
      title: "Search source",
      status: "done",
      detail: "rg foo · /tmp/src · foo",
    });
  });
});
