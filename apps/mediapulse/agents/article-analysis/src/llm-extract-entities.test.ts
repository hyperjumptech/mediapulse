/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  buildExtractionSystemContent,
  buildExtractionUserContent,
  normalizeLlmExtractionWire,
  normalizeLlmUsageFromSdk,
} from "./llm-extract-entities.js";

const TID = "11111111-1111-4111-a111-111111111111";
const RID = "22222222-2222-4222-a222-222222222222";

describe("buildExtractionSystemContent", () => {
  it("includes vocabulary ids and labels", () => {
    // Act
    const text = buildExtractionSystemContent({
      entityTypes: [{ id: TID, name: "Company", description: null }],
      relationTypes: [{ id: RID, name: "PART_OF", description: null }],
    });
    // Assert
    expect(text).toContain(TID);
    expect(text).toContain("Company");
    expect(text).toContain(RID);
    expect(text).toContain("PART_OF");
    expect(text).toContain("articleMentions");
  });
});

describe("buildExtractionUserContent", () => {
  it("includes ticker title and body", () => {
    const u = buildExtractionUserContent({
      tickerId: "T",
      title: "Hello",
      contentTruncated: "Body text",
    });
    expect(u).toContain("T");
    expect(u).toContain("Hello");
    expect(u).toContain("Body text");
  });
});

describe("normalizeLlmExtractionWire", () => {
  it("maps empty description and NONE sentiment to null", () => {
    const out = normalizeLlmExtractionWire({
      entities: [
        {
          canonicalName: "Acme",
          typeId: TID,
          description: "",
          aliases: ["ACME"],
        },
      ],
      relations: [],
      articleMentions: [
        {
          entityName: "Acme",
          mentionCount: 1,
          confidence: 0.9,
          sentiment: "NONE",
        },
      ],
    });
    expect(out.entities[0]?.description).toBeNull();
    expect(out.articleMentions[0]?.sentiment).toBeNull();
  });

  it("preserves non-empty description and concrete sentiment", () => {
    const out = normalizeLlmExtractionWire({
      entities: [
        {
          canonicalName: "Acme",
          typeId: TID,
          description: "  HQ  ",
          aliases: [],
        },
      ],
      relations: [],
      articleMentions: [
        {
          entityName: "Acme",
          mentionCount: 1,
          confidence: 0.5,
          sentiment: "NEGATIVE",
        },
      ],
    });
    expect(out.entities[0]?.description).toBe("HQ");
    expect(out.articleMentions[0]?.sentiment).toBe("NEGATIVE");
  });
});

describe("normalizeLlmUsageFromSdk", () => {
  it("returns null when all token fields are absent", () => {
    expect(normalizeLlmUsageFromSdk({})).toBeNull();
    expect(
      normalizeLlmUsageFromSdk({
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
      }),
    ).toBeNull();
  });

  it("coalesces partial usage into a numeric triple", () => {
    expect(
      normalizeLlmUsageFromSdk({
        inputTokens: 3,
        outputTokens: 2,
        totalTokens: undefined,
      }),
    ).toEqual({
      inputTokens: 3,
      outputTokens: 2,
      totalTokens: 5,
    });
  });

  it("respects explicit totalTokens", () => {
    expect(
      normalizeLlmUsageFromSdk({
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 99,
      }),
    ).toEqual({
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 99,
    });
  });
});
