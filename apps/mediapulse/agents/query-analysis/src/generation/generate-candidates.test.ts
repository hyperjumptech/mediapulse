/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { generateQueryCandidates } from "./generate-candidates";

const ai = { apiKey: "sk", model: "test-model", baseUrl: "" };

const baseInput = {
  ticker: {
    symbol: "FORE",
    name: "PT Fore Kopi Indonesia Tbk",
    aliases: ["Fore Coffee"],
  },
  classification: { sector: "Barang Konsumen Primer", industry: "Minuman" },
  market: { homeMarket: "Indonesia", anchors: ["Indonesia", "IDX"] },
  contractBrief: "Track FORE and the Indonesian beverage industry.",
  competitors: [
    { name: "Kopi Kenangan", aliases: [], searchKeywords: ["kopi kenangan"] },
  ],
  regulators: [{ name: "BPOM", aliases: [], searchKeywords: ["bpom kopi"] }],
  mainInputs: ["arabica beans", "dairy"],
  customerSegments: ["urban middle class"],
  languages: ["id", "en"] as const,
  currentDate: "2026-07-08",
  ai,
};

const okResult = (candidates: { i: number; l: string; s: string }[]) => ({
  object: candidates,
  usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
});

describe("generateQueryCandidates", () => {
  it("decodes the compact schema to the Candidate shape and threads usage", async () => {
    // Setup
    const onUsage = vi.fn();
    const generate = vi.fn().mockResolvedValue(
      okResult([
        { i: 1, l: "id", s: "saham FORE laporan keuangan" },
        { i: 5, l: "id", s: "Kopi Kenangan ekspansi gerai" },
        { i: 11, l: "id", s: "suku bunga BI dampak konsumsi ritel" },
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
      {
        text: "saham FORE laporan keuangan",
        intent: "fundamental",
        language: "id",
      },
      {
        text: "Kopi Kenangan ekspansi gerai",
        intent: "competitor",
        language: "id",
      },
      {
        text: "suku bunga BI dampak konsumsi ritel",
        intent: "macro",
        language: "id",
      },
    ]);
    expect(onUsage).toHaveBeenCalledWith({
      promptTokens: 20,
      completionTokens: 10,
      totalTokens: 30,
    });
  });

  it("drops candidates whose intent number is out of range", async () => {
    // Setup
    const generate = vi
      .fn()
      .mockResolvedValue(okResult([{ i: 5, l: "id", s: "Kopi Kenangan" }]));

    // Act
    const result = await generateQueryCandidates({ ...baseInput, generate });

    // Assert
    expect(result).toEqual([
      { text: "Kopi Kenangan", intent: "competitor", language: "id" },
    ]);
  });

  it("puts the contract brief and disambiguation guidance in the system prompt", async () => {
    // Setup
    const generate = vi
      .fn()
      .mockResolvedValue(okResult([{ i: 5, l: "en", s: "x" }]));

    // Act
    await generateQueryCandidates({ ...baseInput, generate });

    // Assert
    const call = generate.mock.calls[0]?.[0];
    expect(call.output).toBe("array");
    expect(call.system).toContain("<product_contract>");
    expect(call.system).toContain(
      "Track FORE and the Indonesian beverage industry.",
    );
    expect(call.system).toContain("Use the actual company");
    expect(call.system).toContain("Bank Rakyat Indonesia (BBRI)");
    expect(call.system).toContain("The disambiguation rule");
    expect(call.maxRetries).toBeGreaterThan(0);
  });

  it("anchors the system prompt to the current date, home market, and no-trailing-punctuation", async () => {
    // Setup
    const generate = vi
      .fn()
      .mockResolvedValue(okResult([{ i: 5, l: "en", s: "x" }]));

    // Act
    await generateQueryCandidates({ ...baseInput, generate });

    // Assert
    const call = generate.mock.calls[0]?.[0];
    expect(call.system).toContain("Today's date is 2026-07-08.");
    expect(call.system).toContain("Indonesia stock market");
    expect(call.system).toContain("no trailing punctuation");
    expect(call.system).toContain("Do not append an explicit year");
  });

  it("includes the brand alias, main inputs, and customer segments in the user prompt", async () => {
    // Setup
    const generate = vi
      .fn()
      .mockResolvedValue(okResult([{ i: 5, l: "en", s: "x" }]));

    // Act
    await generateQueryCandidates({ ...baseInput, generate });

    // Assert
    const prompt = generate.mock.calls[0]?.[0].prompt;
    expect(prompt).toContain("also known as Fore Coffee");
    expect(prompt).toContain("Main inputs: arabica beans, dairy");
    expect(prompt).toContain("Customer segments: urban middle class");
  });

  it("strips trailing commas, semicolons, and periods but keeps question marks", async () => {
    // Setup
    const generate = vi.fn().mockResolvedValue(
      okResult([
        { i: 11, l: "id", s: "Perkembangan ekonomi Indonesia," },
        { i: 1, l: "id", s: "saham FORE IDX." },
        { i: 5, l: "id", s: "berita kopi kenangan;" },
        { i: 2, l: "id", s: "apa itu RUPS FORE?" },
      ]),
    );

    // Act
    const result = await generateQueryCandidates({ ...baseInput, generate });

    // Assert
    expect(result.map((candidate) => candidate.text)).toEqual([
      "Perkembangan ekonomi Indonesia",
      "saham FORE IDX",
      "berita kopi kenangan",
      "apa itu RUPS FORE?",
    ]);
  });

  it("includes the recent-signals block only when reconSignals are provided", async () => {
    // Setup
    const generate = vi
      .fn()
      .mockResolvedValue(okResult([{ i: 5, l: "en", s: "x" }]));

    // Act
    await generateQueryCandidates({ ...baseInput, generate });
    const withoutSignals = generate.mock.calls[0]?.[0].prompt;

    generate.mockClear();
    await generateQueryCandidates({
      ...baseInput,
      generate,
      reconSignals: ["Kopi Kenangan raises Series C", "Arabica prices spike"],
    });
    const withSignals = generate.mock.calls[0]?.[0].prompt;

    // Assert
    expect(withoutSignals).not.toContain("Recent signals");
    expect(withSignals).toContain("Recent signals");
    expect(withSignals).toContain("- Kopi Kenangan raises Series C");
  });

  it("includes excludeQueries steering text only when provided", async () => {
    // Setup
    const generate = vi
      .fn()
      .mockResolvedValue(okResult([{ i: 5, l: "en", s: "x" }]));

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
    expect(withoutExclude).not.toContain("zero results");
    expect(withExclude).toContain("zero results");
    expect(withExclude).toContain("- FORE");
    expect(withExclude).toContain("- fore news");
  });

  it("salvages valid candidates from the raw output when strict validation throws", async () => {
    // Setup
    const error = Object.assign(new Error("schema mismatch"), {
      name: "AI_NoObjectGeneratedError",
      text: JSON.stringify({
        elements: [
          {
            i: 1,
            l: "id",
            q: "a reasoning string the model wrongly wrote here",
            s: "saham FORE laporan keuangan",
          },
          { i: 5, l: "id", q: null, s: "Kopi Kenangan ekspansi gerai" },
          { i: 99, l: "id", s: "out of range, dropped" },
        ],
      }),
    });
    const generate = vi.fn().mockRejectedValue(error);
    const warn = vi.fn();

    // Act
    const result = await generateQueryCandidates({
      ...baseInput,
      generate,
      logger: { warn },
    });

    // Assert
    expect(result).toEqual([
      {
        text: "saham FORE laporan keuangan",
        intent: "fundamental",
        language: "id",
      },
      {
        text: "Kopi Kenangan ekspansi gerai",
        intent: "competitor",
        language: "id",
      },
    ]);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ salvaged: 2 }),
      expect.stringContaining("salvaged"),
    );
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
