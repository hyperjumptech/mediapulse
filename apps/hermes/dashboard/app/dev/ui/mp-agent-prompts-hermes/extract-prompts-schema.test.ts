import type { JsonSchema } from "@workspace/json-schema-form";
import { describe, expect, it } from "vitest";

import { extractPromptsSchema } from "./extract-prompts-schema";

describe("extractPromptsSchema", () => {
  it("returns the prompts object schema when present", () => {
    const prompts: JsonSchema = {
      type: "object",
      properties: {
        systemPrompt: { type: "string", format: "textarea" },
      },
    };
    const full: JsonSchema = {
      type: "object",
      properties: { openaiApiKey: { type: "string" }, prompts },
    };

    expect(extractPromptsSchema(full)).toEqual(prompts);
  });

  it("returns undefined when prompts is missing", () => {
    const full: JsonSchema = {
      type: "object",
      properties: { openaiApiKey: { type: "string" } },
    };

    expect(extractPromptsSchema(full)).toBeUndefined();
  });

  it("returns undefined when prompts is not an object schema", () => {
    const full: JsonSchema = {
      type: "object",
      properties: { prompts: { type: "string" } },
    };

    expect(extractPromptsSchema(full)).toBeUndefined();
  });
});
