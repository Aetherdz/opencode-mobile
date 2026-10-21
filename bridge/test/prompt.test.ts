import { describe, expect, it } from "vitest";
import { stripReadInstructions, withReadInstructions } from "../src/prompt.js";

const textFile = {
  name: "notes.md",
  mime: "text/markdown",
  path: "/home/owner/work/.opencode-uploads/ses_1/notes.md",
};

const imageFile = {
  name: "screen.png",
  mime: "image/png",
  path: "/home/owner/work/.opencode-uploads/ses_1/screen.png",
};

describe("attachment prompt", () => {
  it("adds read instructions for text and code files only", () => {
    const prompt = withReadInstructions("Summarize these.", [textFile, imageFile]);
    expect(prompt).toContain("read /home/owner/work/.opencode-uploads/ses_1/notes.md");
    expect(prompt).not.toContain("screen.png");
    expect(prompt.startsWith("Summarize these.\n\n")).toBe(true);
  });

  it("strips generated instructions from the displayed user message", () => {
    const prompt = withReadInstructions("Summarize these.", [textFile]);
    expect(stripReadInstructions(prompt)).toBe("Summarize these.");
  });

  it("keeps binary-only prompts unchanged", () => {
    expect(withReadInstructions("Look at this.", [imageFile])).toBe("Look at this.");
    expect(stripReadInstructions("Look at this.")).toBe("Look at this.");
  });
});
