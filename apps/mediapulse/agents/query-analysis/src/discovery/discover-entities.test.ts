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
    expect(onUsage).toHaveBeenCalledWith({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  });

  it("prepends the contract brief to the system prompt", async () => {
    // Setup
    const generate = vi.fn().mockResolvedValue({
      object: { competitors: [], regulators: [] },
      usage: undefined,
    });

    // Act
    await discoverEntities({ ...baseInput, generate });

    // Assert
    const call = generate.mock.calls[0]?.[0];
    expect(call.system).toContain("<product_contract>");
    expect(call.system).toContain("Track BBRI and Indonesian banking.");
    expect(call.maxRetries).toBe(0);
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
    expect(result).toEqual({ competitors: [], regulators: [] });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
