/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { discoverEntities } from "./discover-entities";

const ai = { apiKey: "sk", model: "test-model", baseUrl: "" };

const baseInput = {
  tickerName: "Bank Rakyat Indonesia",
  tickerSymbol: "BBRI",
  classification: { sector: "Keuangan", industry: "Bank" },
  homeMarket: "Indonesia",
  contractBrief: "Track BBRI and Indonesian banking.",
  ai,
  maxCompetitors: 6,
  maxRegulators: 4,
  maxKeywordsPerEntity: 2,
};

describe("discoverEntities", () => {
  it("caps competitors, regulators, and per-entity keywords, and threads usage", async () => {
    // Setup
    const onUsage = vi.fn();
    const generate = vi.fn().mockResolvedValue({
      object: {
        competitors: Array.from({ length: 9 }, (_, index) => ({
          name: `Competitor ${index}`,
          aliases: [],
          searchKeywords: ["a", "b", "c"],
        })),
        regulators: Array.from({ length: 7 }, (_, index) => ({
          name: `Regulator ${index}`,
          aliases: [],
          searchKeywords: ["x", "y", "z"],
        })),
        mainInputs: Array.from({ length: 10 }, (_, index) => `input ${index}`),
        customerSegments: ["urban middle class", "students"],
      },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    // Act
    const result = await discoverEntities({
      ...baseInput,
      generate,
      onUsage,
    });

    // Assert
    expect(result.competitors).toHaveLength(6);
    expect(result.regulators).toHaveLength(4);
    expect(result.competitors[0]?.searchKeywords).toEqual(["a", "b"]);
    expect(result.mainInputs).toHaveLength(8);
    expect(result.customerSegments).toEqual(["urban middle class", "students"]);
    expect(onUsage).toHaveBeenCalledWith({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      reasoningTokens: 0,
    });
  });

  it("prepends the contract brief to the system prompt", async () => {
    // Setup
    const generate = vi.fn().mockResolvedValue({
      object: {
        competitors: [],
        regulators: [],
        mainInputs: [],
        customerSegments: [],
      },
      usage: undefined,
    });

    // Act
    await discoverEntities({ ...baseInput, generate });

    // Assert
    const call = generate.mock.calls[0]?.[0];
    expect(call.system).toContain("<product_contract>");
    expect(call.system).toContain("Track BBRI and Indonesian banking.");
    expect(call.maxRetries).toBeGreaterThan(0);
  });

  it("asks for private or unlisted competitors in the prompt", async () => {
    // Setup
    const generate = vi.fn().mockResolvedValue({
      object: {
        competitors: [],
        regulators: [],
        mainInputs: [],
        customerSegments: [],
      },
      usage: undefined,
    });

    // Act
    await discoverEntities({ ...baseInput, generate });

    // Assert
    const prompt = generate.mock.calls[0]?.[0].prompt;
    expect(prompt).toContain("whether listed or private");
    expect(prompt).not.toContain("prefer listed peers");
  });

  it("drops entities with an empty name", async () => {
    // Setup
    const generate = vi.fn().mockResolvedValue({
      object: {
        competitors: [
          { name: "", aliases: [], searchKeywords: [] },
          { name: "Tomoro", aliases: [], searchKeywords: [] },
        ],
        regulators: [],
        mainInputs: [],
        customerSegments: [],
      },
      usage: undefined,
    });

    // Act
    const result = await discoverEntities({ ...baseInput, generate });

    // Assert
    expect(result.competitors.map((entity) => entity.name)).toEqual(["Tomoro"]);
  });

  it("salvages entities from raw output when strict validation throws", async () => {
    // Setup
    const warn = vi.fn();
    const error = Object.assign(new Error("schema mismatch"), {
      name: "AI_NoObjectGeneratedError",
      text: JSON.stringify({
        competitors: [
          {
            name: "Kopi Kenangan",
            aliases: [],
            searchKeywords: ["kopi kenangan"],
          },
        ],
        regulators: [],
        mainInputs: ["arabica beans"],
        customerSegments: [],
      }),
    });
    const generate = vi.fn().mockRejectedValue(error);

    // Act
    const result = await discoverEntities({
      ...baseInput,
      generate,
      logger: { warn },
    });

    // Assert
    expect(result.competitors.map((entity) => entity.name)).toEqual([
      "Kopi Kenangan",
    ]);
    expect(result.mainInputs).toEqual(["arabica beans"]);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ tickerSymbol: "BBRI" }),
      expect.stringContaining("salvaged"),
    );
  });

  it("degrades to an empty result when the LLM call throws", async () => {
    // Setup
    const warn = vi.fn();
    const generate = vi.fn().mockRejectedValue(new Error("boom"));

    // Act
    const result = await discoverEntities({
      ...baseInput,
      generate,
      logger: { warn },
    });

    // Assert
    expect(result).toEqual({
      competitors: [],
      regulators: [],
      mainInputs: [],
      customerSegments: [],
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
