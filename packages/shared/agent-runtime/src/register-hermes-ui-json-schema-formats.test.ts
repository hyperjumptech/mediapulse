import { describe, expect, it } from "vitest";

import {
  HERMES_UI_TEXTAREA_FORMAT,
  registerHermesUiJsonSchemaFormats,
} from "./register-hermes-ui-json-schema-formats";

describe("registerHermesUiJsonSchemaFormats", () => {
  it("registers textarea format so AJV compiles schemas with prompts.systemPrompt", () => {
    const formats = new Map<string, unknown>();
    const ajv = {
      addFormat: (name: string, format: unknown) => {
        formats.set(name, format);
        return ajv;
      },
    };

    registerHermesUiJsonSchemaFormats(ajv);

    expect(formats.has(HERMES_UI_TEXTAREA_FORMAT)).toBe(true);
    const textarea = formats.get(HERMES_UI_TEXTAREA_FORMAT) as {
      type?: string;
      validate: (data: unknown) => boolean;
    };
    expect(textarea.type).toBe("string");
    expect(textarea.validate("multi\nline")).toBe(true);
  });
});
