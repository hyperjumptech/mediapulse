/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  findUnknownLlmPromptPlaceholderTokens,
  listLlmPromptPlaceholderNames,
  substituteLlmPromptTemplate,
} from "./llm-prompt-template.js";

describe("listLlmPromptPlaceholderNames", () => {
  it("returns sorted unique names", () => {
    // Act
    const names = listLlmPromptPlaceholderNames(
      "{{a}} static {{b}} {{a}}",
    );

    // Assert
    expect(names).toEqual(["a", "b"]);
  });

  it("returns empty when there are no placeholders", () => {
    expect(listLlmPromptPlaceholderNames("no tokens")).toEqual([]);
  });
});

describe("findUnknownLlmPromptPlaceholderTokens", () => {
  it("returns names not in the allowed set", () => {
    // Act
    const unknown = findUnknownLlmPromptPlaceholderTokens(
      "Hello {{good}} and {{bad}}",
      new Set(["good"]),
    );

    // Assert
    expect(unknown).toEqual(["bad"]);
  });
});

describe("substituteLlmPromptTemplate", () => {
  it("replaces known placeholders", () => {
    // Act
    const out = substituteLlmPromptTemplate("x={{a}} y={{b}}", {
      a: "1",
      b: "2",
    });

    // Assert
    expect(out).toBe("x=1 y=2");
  });

  it("leaves unknown tokens unchanged when no replacement", () => {
    const out = substituteLlmPromptTemplate("{{missing}}", {});
    expect(out).toBe("{{missing}}");
  });
});
