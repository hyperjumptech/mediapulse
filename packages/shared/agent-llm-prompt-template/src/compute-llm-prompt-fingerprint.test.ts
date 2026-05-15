import { describe, expect, it } from "vitest";

import { computeLlmPromptFingerprint } from "./compute-llm-prompt-fingerprint.js";

describe("computeLlmPromptFingerprint", () => {
  it("returns the same value for identical prompt pairs", () => {
    const a = computeLlmPromptFingerprint("sys", "user");
    const b = computeLlmPromptFingerprint("sys", "user");
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });

  it("differs when only system prompt changes", () => {
    const u = "user";
    const h1 = computeLlmPromptFingerprint("sys-a", u);
    const h2 = computeLlmPromptFingerprint("sys-b", u);
    expect(h1).not.toBe(h2);
  });

  it("differs when system and user are concatenated differently than swapped order", () => {
    const h1 = computeLlmPromptFingerprint("a", "b");
    const h2 = computeLlmPromptFingerprint("b", "a");
    expect(h1).not.toBe(h2);
  });
});
