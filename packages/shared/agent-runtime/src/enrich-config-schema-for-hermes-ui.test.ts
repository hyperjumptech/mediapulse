import { describe, expect, it } from "vitest";

import { enrichConfigSchemaForHermesUi } from "./enrich-config-schema-for-hermes-ui";

describe("enrichConfigSchemaForHermesUi", () => {
  it("adds textarea format to prompts.systemPrompt and prompts.userPromptTemplate", () => {
    const schema = {
      type: "object",
      properties: {
        openaiApiKey: { type: "string" },
        prompts: {
          type: "object",
          properties: {
            systemPrompt: { type: "string", description: "system" },
            userPromptTemplate: { type: "string", description: "user" },
          },
        },
      },
    };

    const enriched = enrichConfigSchemaForHermesUi(schema);
    const prompts = (enriched.properties as Record<string, unknown>)
      .prompts as Record<string, unknown>;
    const promptProps = prompts.properties as Record<
      string,
      Record<string, unknown>
    >;

    expect(promptProps.systemPrompt?.format).toBe("textarea");
    expect(promptProps.userPromptTemplate?.format).toBe("textarea");
    const originalPromptProps = (
      (schema.properties as Record<string, unknown>).prompts as Record<
        string,
        unknown
      >
    ).properties as Record<string, Record<string, unknown>>;
    expect(originalPromptProps.systemPrompt?.format).toBeUndefined();
    expect(originalPromptProps.userPromptTemplate?.format).toBeUndefined();
  });

  it("leaves fields untouched (except propertyOrder) when prompts object is missing", () => {
    const schema = {
      type: "object",
      properties: { limit: { type: "number" } },
    };

    const enriched = enrichConfigSchemaForHermesUi(schema);

    expect(enriched).not.toBe(schema);
    expect((enriched.properties as Record<string, unknown>).limit).toEqual({
      type: "number",
    });
    expect(enriched.propertyOrder).toEqual(["limit"]);
  });

  it("records propertyOrder on every object, array item, and union variant", () => {
    const schema = {
      type: "object",
      properties: {
        language_model: {
          type: "object",
          properties: {
            baseUrl: { type: "string" },
            model: { type: "string" },
            apiKey: { type: "string" },
          },
        },
        web_search: {
          type: "array",
          items: {
            anyOf: [
              {
                type: "object",
                properties: {
                  provider: { type: "string" },
                  apiKey: { type: "string" },
                },
              },
            ],
          },
        },
      },
    };

    const enriched = enrichConfigSchemaForHermesUi(schema);
    const properties = enriched.properties as Record<
      string,
      Record<string, unknown>
    >;
    const item = (properties.web_search?.items as Record<string, unknown>)
      .anyOf as Record<string, unknown>[];

    expect(enriched.propertyOrder).toEqual(["language_model", "web_search"]);
    expect(properties.language_model?.propertyOrder).toEqual([
      "baseUrl",
      "model",
      "apiKey",
    ]);
    expect(item[0]?.propertyOrder).toEqual(["provider", "apiKey"]);
  });

  it("skips non-string prompt fields", () => {
    const schema = {
      type: "object",
      properties: {
        prompts: {
          type: "object",
          properties: {
            systemPrompt: { type: "number" },
          },
        },
      },
    };

    const enriched = enrichConfigSchemaForHermesUi(schema);
    const promptProps = (
      (enriched.properties as Record<string, unknown>).prompts as Record<
        string,
        unknown
      >
    ).properties as Record<string, Record<string, unknown>>;

    expect(promptProps.systemPrompt?.format).toBeUndefined();
  });

  it("returns clone unchanged when root has no properties object", () => {
    const schema = { type: "object" };

    expect(enrichConfigSchemaForHermesUi(schema)).toEqual({ type: "object" });
  });
});
