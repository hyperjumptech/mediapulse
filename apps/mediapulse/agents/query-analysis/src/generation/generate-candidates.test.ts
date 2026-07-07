/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { generateQueryCandidates } from "./generate-candidates";

const ai = { apiKey: "sk", model: "test-model", baseUrl: "" };

const baseInput = {
  ticker: { symbol: "FORE", name: "PT Fore Kopi Indonesia Tbk" },
  classification: { sector: "Barang Konsumen Primer", industry: "Minuman" },
  market: { homeMarket: "Indonesia", anchors: ["Indonesia", "IDX"] },
  contractBrief: "Track FORE and the Indonesian beverage industry.",
  competitors: [
    { name: "Kopi Kenangan", aliases: [], searchKeywords: ["kopi kenangan"] },
  ],
  regulators: [{ name: "BPOM", aliases: [], searchKeywords: ["bpom kopi"] }],
  languages: ["id", "en"] as const,
  ai,
};

const okResult = (
  candidates: { text: string; intent: string; language: string }[],
) => ({
  object: { candidates },
  usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
});

describe("generateQueryCandidates", () => {
  it("maps the model's candidates to the Candidate shape and threads usage", async () => {
    // Setup
    const onUsage = vi.fn();
    const generate = vi.fn().mockResolvedValue(
      okResult([
        { text: "saham FORE IDX", intent: "breaking", language: "id" },
        {
          text: "Kopi Kenangan kopi kenangan",
          intent: "competitor",
          language: "id",
        },
      ]),
    );

    // Act
    const result = await generateQueryCandidates({
      ...baseInput,
      generate,
      onUsage,
    });

    // Assert
    expect(result).toEqual([
      { text: "saham FORE IDX", intent: "breaking", language: "id" },
      {
        text: "Kopi Kenangan kopi kenangan",
        intent: "competitor",
        language: "id",
      },
    ]);
    expect(onUsage).toHaveBeenCalledWith({
      promptTokens: 20,
      completionTokens: 10,
      totalTokens: 30,
    });
  });

  it("prepends the contract brief and includes the disambiguation instruction", async () => {
    // Setup
    const generate = vi
      .fn()
      .mockResolvedValue(
        okResult([{ text: "x", intent: "wildcard", language: "en" }]),
      );

    // Act
    await generateQueryCandidates({ ...baseInput, generate });

    // Assert
    const call = generate.mock.calls[0]?.[0];
    expect(call.system).toContain("<product_contract>");
    expect(call.system).toContain(
      "Track FORE and the Indonesian beverage industry.",
    );
    expect(call.prompt).toContain("FORE");
    expect(call.prompt).toContain("G/FORE");
    expect(call.prompt).toContain("ambiguous bare queries");
    expect(call.maxRetries).toBeGreaterThan(0);
  });

  it("includes excludeQueries steering text only when provided", async () => {
    // Setup
    const generate = vi
      .fn()
      .mockResolvedValue(
        okResult([{ text: "x", intent: "wildcard", language: "en" }]),
      );

    // Act
    await generateQueryCandidates({ ...baseInput, generate });
    const withoutExclude = generate.mock.calls[0]?.[0].prompt;

    generate.mockClear();
    await generateQueryCandidates({
      ...baseInput,
      generate,
      excludeQueries: ["FORE", "fore news"],
    });
    const withExclude = generate.mock.calls[0]?.[0].prompt;

    // Assert
    expect(withoutExclude).not.toContain("zero search results");
    expect(withExclude).toContain("zero search results");
    expect(withExclude).toContain("- FORE");
    expect(withExclude).toContain("- fore news");
  });

  it("returns an empty array and logs a warning when the LLM call throws", async () => {
    // Setup
    const warn = vi.fn();
    const generate = vi.fn().mockRejectedValue(new Error("boom"));

    // Act
    const result = await generateQueryCandidates({
      ...baseInput,
      generate,
      logger: { warn },
    });

    // Assert
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ tickerSymbol: "FORE" }),
      expect.stringContaining("returning no candidates"),
    );
  });
});
