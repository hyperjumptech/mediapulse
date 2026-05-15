import { describe, expect, it } from "vitest";

import {
  findUnknownLlmPromptPlaceholderTokens,
  listLlmPromptPlaceholderNames,
  substituteLlmPromptTemplate,
} from "./llm-prompt-template.js";

describe("listLlmPromptPlaceholderNames", () => {
  it("returns sorted unique names", () => {
    expect(listLlmPromptPlaceholderNames("{{b}} {{a}} {{b}}")).toEqual(["a", "b"]);
  });
});

describe("findUnknownLlmPromptPlaceholderTokens", () => {
  it("returns unknown tokens", () => {
    expect(
      findUnknownLlmPromptPlaceholderTokens("{{ok}} {{bad}}", new Set(["ok"])),
    ).toEqual(["bad"]);
  });
});

describe("substituteLlmPromptTemplate", () => {
  it("replaces placeholders", () => {
    expect(substituteLlmPromptTemplate("v={{x}}", { x: "y" })).toBe("v=y");
  });
});
