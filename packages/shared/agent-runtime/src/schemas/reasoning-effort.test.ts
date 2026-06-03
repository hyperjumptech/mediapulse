import { describe, expect, it } from "vitest";

import {
  buildOpenAiReasoningProviderOptions,
  reasoningEffortSchema,
} from "./reasoning-effort.js";

describe("reasoningEffortSchema", () => {
  it("accepts all four valid values", () => {
    for (const value of ["minimal", "low", "medium", "high"] as const) {
      expect(reasoningEffortSchema.parse(value)).toBe(value);
    }
  });

  it("rejects an unknown value", () => {
    expect(() => reasoningEffortSchema.parse("extreme")).toThrow();
  });
});

describe("buildOpenAiReasoningProviderOptions", () => {
  it("returns undefined when effort is undefined", () => {
    expect(buildOpenAiReasoningProviderOptions(undefined)).toBeUndefined();
  });

  it("returns the correct provider option shape for each effort value", () => {
    for (const effort of ["minimal", "low", "medium", "high"] as const) {
      expect(buildOpenAiReasoningProviderOptions(effort)).toEqual({
        openai: { reasoningEffort: effort },
      });
    }
  });
});
