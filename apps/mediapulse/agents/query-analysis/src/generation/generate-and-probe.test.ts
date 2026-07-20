/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import type { CountQueryHitsContext } from "@workspace/agent-search";

import { generateAndProbeCandidates } from "./generate-and-probe";

const ai = { apiKey: "sk", model: "test-model", baseUrl: "" };

const baseInput = {
  ticker: { symbol: "FORE", name: "PT Fore Kopi Indonesia Tbk" },
  classification: { sector: "Barang Konsumen Primer", industry: "Minuman" },
  market: { homeMarket: "Indonesia", anchors: ["Indonesia", "IDX"] },
  contractBrief: "Track FORE and the Indonesian beverage industry.",
  competitors: [],
  regulators: [],
  languages: ["id"] as const,
  currentDate: "2026-07-08",
  ai,
  providers: [{ provider: "serper" as const, apiKey: "sk-serper" }],
  locales: [{ gl: "id", hl: "id" }],
  probeBudget: 80,
  probeConcurrency: 4,
  probeMinResults: 1,
  probeTimeoutMs: 30_000,
  minSurvivors: 24,
};

/** Fake `generateObject` returning a fixed candidate batch each call. */
const makeGenerate = (
  batches: { intent: string; language: string; text: string }[][],
) => {
  const generate = vi.fn();
  for (const batch of batches) {
    generate.mockResolvedValueOnce({
      object: batch,
      usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
    });
  }

  return generate;
};

/** Fake `countQueryHits` scoring by an override map, accruing credits. */
const makeCountHits = (hitsByText: Record<string, number>) =>
  vi.fn(async (text: string, context: CountQueryHitsContext) => {
    if (context.creditsSink) {
      context.creditsSink.credits += 1;
    }

    return { hits: hitsByText[text] ?? 0, credits: 1, provider: "serper" };
  });

describe("generateAndProbeCandidates", () => {
  it("stops after the first attempt when nothing comes back zero-hit", async () => {
    // Setup
    const generate = makeGenerate([
      [
        {
          intent: "regulatoryPolicyWatch",
          language: "id",
          text: "saham FORE IDX",
        },
      ],
    ]);
    const countHits = makeCountHits({ "saham FORE IDX": 5 });

    // Act
    const result = await generateAndProbeCandidates(
      { ...baseInput, generate },
      { probeDeps: { countHits: countHits as never } },
    );

    // Assert
    expect(result.attempts).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.survivors.map((s) => s.text)).toEqual(["saham FORE IDX"]);
  });

  it("retries with the zero-hit texts as excludeQueries, and re-probes only the delta", async () => {
    // Setup
    const generate = makeGenerate([
      [{ intent: "regulatoryPolicyWatch", language: "id", text: "FORE" }],
      [
        {
          intent: "regulatoryPolicyWatch",
          language: "id",
          text: "saham FORE IDX",
        },
      ],
    ]);
    const countHits = makeCountHits({
      FORE: 0,
      "saham FORE IDX": 8,
    });

    // Act
    const result = await generateAndProbeCandidates(
      { ...baseInput, generate },
      { probeDeps: { countHits: countHits as never } },
    );

    // Assert
    expect(result.attempts).toBe(2);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]?.[0].prompt).toContain("- FORE");
    // Only the delta (2 candidates total across attempts) got probed, not a re-probe of "FORE".
    expect(countHits).toHaveBeenCalledTimes(2);
    expect(result.survivors.map((s) => s.text)).toEqual(["saham FORE IDX"]);
    expect(result.dropped.map((d) => d.text)).toEqual(["FORE"]);
  });

  it("stops retrying once minSurvivors is reached even if some candidates are zero-hit", async () => {
    // Setup
    const generate = makeGenerate([
      [
        {
          intent: "regulatoryPolicyWatch",
          language: "id",
          text: "saham FORE IDX",
        },
        { intent: "regulatoryPolicyWatch", language: "id", text: "FORE" },
      ],
    ]);
    const countHits = makeCountHits({ "saham FORE IDX": 5, FORE: 0 });

    // Act
    const result = await generateAndProbeCandidates(
      { ...baseInput, minSurvivors: 1, generate },
      { probeDeps: { countHits: countHits as never } },
    );

    // Assert
    expect(result.attempts).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.survivors.map((s) => s.text)).toEqual(["saham FORE IDX"]);
    expect(result.dropped.map((d) => d.text)).toEqual(["FORE"]);
  });

  it("stops after GENERATION_MAX_ATTEMPTS even if every attempt is zero-hit", async () => {
    // Setup
    const generate = makeGenerate([
      [{ intent: "regulatoryPolicyWatch", language: "id", text: "a" }],
      [{ intent: "regulatoryPolicyWatch", language: "id", text: "b" }],
      [{ intent: "regulatoryPolicyWatch", language: "id", text: "c" }],
    ]);
    const countHits = makeCountHits({});

    // Act
    const result = await generateAndProbeCandidates(
      { ...baseInput, generate },
      { probeDeps: { countHits: countHits as never } },
    );

    // Assert
    expect(result.attempts).toBe(3);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(result.survivors).toEqual([]);
    expect(result.dropped.map((d) => d.text).sort()).toEqual(["a", "b", "c"]);
  });

  it("yields no survivors and stops after one attempt when the generation LLM call fails", async () => {
    // Setup
    const generate = vi.fn().mockRejectedValue(new Error("boom"));
    const countHits = makeCountHits({ FORE: 5 });

    // Act
    const result = await generateAndProbeCandidates(
      { ...baseInput, generate },
      { probeDeps: { countHits: countHits as never } },
    );

    // Assert
    expect(result.attempts).toBe(1);
    expect(result.survivors).toEqual([]);
    expect(result.dropped).toEqual([]);
    expect(countHits).not.toHaveBeenCalled();
  });
});
