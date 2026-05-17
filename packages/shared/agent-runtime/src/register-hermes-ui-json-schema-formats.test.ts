import Ajv from "ajv";
import { describe, expect, it } from "vitest";

import {
  HERMES_UI_TEXTAREA_FORMAT,
  registerHermesUiJsonSchemaFormats,
} from "./register-hermes-ui-json-schema-formats";

describe("registerHermesUiJsonSchemaFormats", () => {
  it("registers textarea format so AJV compiles schemas with prompts.systemPrompt", () => {
    const ajv = new Ajv({ allErrors: true });
    registerHermesUiJsonSchemaFormats(ajv);

    const validate = ajv.compile({
      type: "object",
      properties: {
        systemPrompt: { type: "string", format: HERMES_UI_TEXTAREA_FORMAT },
      },
    });

    expect(validate({ systemPrompt: "multi\nline" })).toBe(true);
    expect(validate({ systemPrompt: 1 })).toBe(false);
  });
});
