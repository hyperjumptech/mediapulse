import { describe, expect, it, vi } from "vitest";

import {
  findMissingVariableKeys,
  knowledgeExtractionConfig,
  type KnowledgeExtractionVariableDb,
} from "./knowledge-extraction-config";

describe("knowledgeExtractionConfig", () => {
  it("reads model credentials from Hermes variables at run time", () => {
    expect(knowledgeExtractionConfig()).toEqual({
      model: "google/gemini-2.5-flash-lite",
      apiKey: "{{AI_API_KEY}}",
      baseUrl: "{{AI_BASE_URL}}",
    });
  });
});

describe("findMissingVariableKeys", () => {
  it("lists the required variables Hermes does not hold", async () => {
    const findMany = vi.fn().mockResolvedValue([{ key: "AI_API_KEY" }]);
    const db = {
      variable: { findMany },
    } as unknown as KnowledgeExtractionVariableDb;

    const missing = await findMissingVariableKeys(db);

    expect(missing).toEqual(["AI_BASE_URL"]);
    expect(findMany).toHaveBeenCalledWith({
      where: { key: { in: ["AI_API_KEY", "AI_BASE_URL"] } },
      select: { key: true },
    });
  });
});
