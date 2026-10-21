import { describe, expect, it } from "vitest";
import { RuntimeState } from "../src/state.js";
import type { OpenCodeEvent, RawForm } from "../src/types.js";

let sequence = 0;

function event(type: string, data: Record<string, unknown>): OpenCodeEvent {
  sequence += 1;
  return { id: `evt_${sequence}`, type, data };
}

function questionForm(id = "frm_1", sessionID = "ses_q"): RawForm {
  return {
    id,
    sessionID,
    title: "Implementation plan",
    metadata: { kind: "question" },
    fields: [
      {
        key: "q0",
        type: "string",
        title: "Approach",
        description: "How should I proceed?",
        options: [
          { value: "build", label: "Build" },
          { value: "test", label: "Test" },
        ],
      },
      {
        key: "q1",
        type: "multiselect",
        title: "Checks",
        options: [
          { value: "tests", label: "Tests" },
          { value: "lint", label: "Lint" },
        ],
      },
    ],
  };
}

describe("RuntimeState", () => {
  it("tracks execution, inbox origin, approvals and deletion", () => {
    const state = new RuntimeState();

    state.apply(event("session.execution.started", { sessionID: "ses_1" }));
    expect(state.statusOf("ses_1")).toMatchObject({ status: "running" });
    expect(state.statusOf("ses_1").busyOrigin).toBeUndefined();

    state.apply(
      event("session.inbox.enqueued", {
        sessionID: "ses_1",
        inboxID: "inbox_1",
        item: { type: "user", payload: { text: "hi", metadata: { source: "telegram" } } },
      }),
    );
    expect(state.sourceOf("ses_1")).toBe("telegram");
    expect(state.statusOf("ses_1")).toMatchObject({
      status: "running",
      busyOrigin: "telegram",
    });

    state.apply(
      event("permission.asked", {
        sessionID: "ses_1",
        id: "per_1",
        action: "read",
        resources: ["/tmp/file"],
      }),
    );
    expect(state.statusOf("ses_1").status).toBe("needs_approval");
    expect(state.pendingApprovals("ses_1")).toEqual(["per_1"]);

    state.apply(
      event("permission.replied", {
        sessionID: "ses_1",
        id: "per_1",
        decision: "once",
      }),
    );
    expect(state.pendingApprovals("ses_1")).toEqual([]);
    expect(state.statusOf("ses_1").status).toBe("running");

    state.apply(event("session.execution.succeeded", { sessionID: "ses_1" }));
    expect(state.statusOf("ses_1")).toEqual({ status: "idle" });

    state.apply(
      event("permission.asked", {
        sessionID: "ses_1",
        request: { id: "per_2" },
      }),
    );
    expect(state.pendingApprovals("ses_1")).toEqual(["per_2"]);

    state.apply(event("session.deleted", { sessionID: "ses_1" }));
    expect(state.statusOf("ses_1")).toEqual({ status: "idle" });
    expect(state.sourceOf("ses_1")).toBe("unknown");
    expect(state.pendingApprovals("ses_1")).toEqual([]);
  });

  it("reports both when a session was used from telegram and the app", () => {
    const state = new RuntimeState();
    state.noteSource("ses_2", "telegram");
    state.noteSource("ses_2", "app");
    expect(state.sourceOf("ses_2")).toBe("both");
    expect(state.sourceOf("ses_unknown")).toBe("unknown");
  });

  it("does not let a queued telegram message mark an idle session busy", () => {
    const state = new RuntimeState();
    state.apply(
      event("session.inbox.enqueued", {
        sessionID: "ses_3",
        item: { type: "user", payload: { metadata: { source: "telegram" } } },
      }),
    );

    expect(state.sourceOf("ses_3")).toBe("telegram");
    expect(state.statusOf("ses_3")).toEqual({ status: "idle" });
  });
});

describe("RuntimeState question forms", () => {
  it("reports waiting_input while a question form is pending", () => {
    const state = new RuntimeState();
    state.apply(event("session.execution.started", { sessionID: "ses_q" }));
    state.apply(event("form.created", { sessionID: "ses_q", form: questionForm() }));

    expect(state.statusOf("ses_q").status).toBe("waiting_input");
    expect(state.pendingQuestions("ses_q")).toHaveLength(1);
    expect(state.findQuestion("frm_1")).toMatchObject({
      sessionId: "ses_q",
      question: expect.objectContaining({ id: "frm_1", sessionId: "ses_q" }),
    });
  });

  it("resolves a question as answered and returns to running", () => {
    const state = new RuntimeState();
    state.apply(event("form.created", { sessionID: "ses_q", form: questionForm() }));
    state.apply(event("form.replied", { sessionID: "ses_q", id: "frm_1" }));

    expect(state.pendingQuestions("ses_q")).toEqual([]);
    expect(state.statusOf("ses_q").status).toBe("running");
    expect(state.findQuestion("frm_1")).toMatchObject({
      sessionId: "ses_q",
      question: null,
      resolvedStatus: "answered",
    });
  });

  it("resolves a cancelled question and records the rejected status", () => {
    const state = new RuntimeState();
    state.apply(event("form.created", { sessionID: "ses_q", form: questionForm() }));
    state.apply(event("form.cancelled", { sessionID: "ses_q", form: questionForm() }));

    expect(state.pendingQuestions("ses_q")).toEqual([]);
    expect(state.findQuestion("frm_1")?.resolvedStatus).toBe("rejected");
  });

  it("keeps waiting_input ahead of an approval and falls back to it after an answer", () => {
    const state = new RuntimeState();
    state.apply(
      event("permission.asked", {
        sessionID: "ses_q",
        id: "per_1",
        action: "read",
        resources: ["/tmp/file"],
      }),
    );
    state.apply(event("form.created", { sessionID: "ses_q", form: questionForm() }));

    expect(state.statusOf("ses_q").status).toBe("waiting_input");
    expect(state.pendingApprovals("ses_q")).toEqual(["per_1"]);

    state.apply(event("form.replied", { sessionID: "ses_q", id: "frm_1" }));
    expect(state.statusOf("ses_q").status).toBe("needs_approval");

    state.apply(event("permission.replied", { sessionID: "ses_q", id: "per_1" }));
    expect(state.statusOf("ses_q").status).toBe("running");
  });

  it("replaces the pending set from a refresh and ignores already resolved ids", () => {
    const state = new RuntimeState();
    state.apply(event("form.created", { sessionID: "ses_q", form: questionForm("frm_1") }));
    state.apply(event("form.created", { sessionID: "ses_q", form: questionForm("frm_2") }));
    expect(state.pendingQuestions("ses_q")).toHaveLength(2);

    state.replaceQuestions("ses_q", []);
    expect(state.pendingQuestions("ses_q")).toEqual([]);
    expect(state.findQuestion("frm_1")).toBeNull();
    expect(state.statusOf("ses_q").status).toBe("running");

    state.apply(event("form.replied", { sessionID: "ses_q", id: "frm_1" }));
    state.noteQuestion({
      id: "frm_1",
      sessionId: "ses_q",
      title: "Stale",
      questions: [],
    });
    expect(state.findQuestion("frm_1")?.question).toBeNull();
    expect(state.findQuestion("frm_1")?.resolvedStatus).toBe("answered");
  });

  it("drops question state when the session is deleted", () => {
    const state = new RuntimeState();
    state.apply(event("form.created", { sessionID: "ses_q", form: questionForm() }));
    state.apply(event("session.deleted", { sessionID: "ses_q" }));

    expect(state.pendingQuestions("ses_q")).toEqual([]);
    expect(state.findQuestion("frm_1")).toBeNull();
    expect(state.statusOf("ses_q")).toEqual({ status: "idle" });
  });
});
