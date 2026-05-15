/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  findUnknownLlmPromptPlaceholderTokens,
  listLlmPromptPlaceholderNames,
  substituteLlmPromptTemplate,
} from "./llm-prompt-template";

describe("listLlmPromptPlaceholderNames", () => {
  it("returns sorted unique names", () => {
    const names = listLlmPromptPlaceholderNames("{{a}} {{b}} {{a}}");
    expect(names).toEqual(["a", "b"]);
  });
});

describe("findUnknownLlmPromptPlaceholderTokens", () => {
  it("returns names not in the allowed set", () => {
    const unknown = findUnknownLlmPromptPlaceholderTokens("{{x}}", new Set(["y"]));
    expect(unknown).toEqual(["x"]);
  });
});

describe("substituteLlmPromptTemplate", () => {
  it("replaces known placeholders", () => {
    const out = substituteLlmPromptTemplate("a={{k}}", { k: "v" });
    expect(out).toBe("a=v");
  });
});
