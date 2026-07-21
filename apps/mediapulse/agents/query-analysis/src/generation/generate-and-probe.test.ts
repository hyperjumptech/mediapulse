/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import type { CountQueryHitsContext } from "@workspace/agent-search";

import { GENERATION_MAX_ATTEMPTS } from "../constants";
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
  queriesPerIntent: 1,
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

const ALL_INTENTS = [
  "industryPulse",
  "competitiveLandscape",
  "dealsAndMovements",
  "regulatoryPolicyWatch",
  "disruptorsOrTech",
] as const;

/**
 * One candidate per intent, so the per-intent quota is satisfied and the retry
 * loop is not driven by unrelated intents being empty.
 *
 * @param prefix - Text prefix, so batches across attempts stay distinct.
 */
const onePerIntent = (prefix: string) =>
  ALL_INTENTS.map((intent) => ({
    intent,
    language: "id",
    text: `${prefix} ${intent}`,
  }));

/** Hit map giving every intent-covering candidate a non-zero score. */
const hitsForAll = (prefix: string, hits = 5): Record<string, number> =>
  Object.fromEntries(
    ALL_INTENTS.map((intent) => [`${prefix} ${intent}`, hits]),
  );

describe("generateAndProbeCandidates", () => {
  it("stops after the first attempt when every intent meets its quota", async () => {
    // Setup
    const generate = makeGenerate([onePerIntent("q")]);
    const countHits = makeCountHits(hitsForAll("q"));

    // Act
    const result = await generateAndProbeCandidates(
      { ...baseInput, generate },
      { probeDeps: { countHits: countHits as never } },
    );

    // Assert
    expect(result.attempts).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.survivors).toHaveLength(ALL_INTENTS.length);
  });

  it("retries while an intent is short, even when no candidate was zero-hit", async () => {
    // Setup: attempt 1 covers only one intent, all with hits.
    const generate = makeGenerate([
      [
        {
          intent: "regulatoryPolicyWatch",
          language: "id",
          text: "saham FORE IDX",
        },
      ],
      onePerIntent("q"),
    ]);
    const countHits = makeCountHits({
      "saham FORE IDX": 5,
      ...hitsForAll("q"),
    });

    // Act
    const result = await generateAndProbeCandidates(
      { ...baseInput, generate },
      { probeDeps: { countHits: countHits as never } },
    );

    // Assert
    expect(result.attempts).toBe(2);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("tells the next attempt which intents are short", async () => {
    // Setup
    const generate = makeGenerate([
      [
        {
          intent: "regulatoryPolicyWatch",
          language: "id",
          text: "saham FORE IDX",
        },
      ],
      onePerIntent("q"),
    ]);
    const countHits = makeCountHits({
      "saham FORE IDX": 5,
      ...hitsForAll("q"),
    });

    // Act
    await generateAndProbeCandidates(
      { ...baseInput, generate },
      { probeDeps: { countHits: countHits as never } },
    );

    // Assert
    const secondPrompt = String(generate.mock.calls[1]![0].prompt);

    expect(secondPrompt).toContain("under-filled these intents");
    expect(secondPrompt).toContain("industryPulse");
    expect(secondPrompt).not.toContain("regulatoryPolicyWatch: ");
  });

  it("retries with the zero-hit texts as excludeQueries, and re-probes only the delta", async () => {
    // Setup
    const generate = makeGenerate([
      [{ intent: "regulatoryPolicyWatch", language: "id", text: "FORE" }],
      onePerIntent("q"),
    ]);
    const countHits = makeCountHits({ FORE: 0, ...hitsForAll("q") });

    // Act
    const result = await generateAndProbeCandidates(
      { ...baseInput, generate },
      { probeDeps: { countHits: countHits as never } },
    );

    // Assert
    expect(result.attempts).toBe(2);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]?.[0].prompt).toContain("- FORE");
    // Only the delta got probed (1 from attempt one, 5 from attempt two), with
    // no re-probe of "FORE".
    expect(countHits).toHaveBeenCalledTimes(1 + ALL_INTENTS.length);
    expect(result.survivors).toHaveLength(ALL_INTENTS.length);
    expect(result.dropped.map((d) => d.text)).toEqual(["FORE"]);
  });

  it("stops retrying once every intent has met its per-intent quota", async () => {
    // Setup
    const generate = makeGenerate([
      [
        ...onePerIntent("q"),
        { intent: "industryPulse", language: "id", text: "FORE" },
      ],
    ]);
    const countHits = makeCountHits({ ...hitsForAll("q"), FORE: 0 });

    // Act
    const result = await generateAndProbeCandidates(
      { ...baseInput, queriesPerIntent: 1, generate },
      { probeDeps: { countHits: countHits as never } },
    );

    // Assert
    expect(result.attempts).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.survivors).toHaveLength(ALL_INTENTS.length);
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

  it("retries a failing generation call up to the attempt cap, then yields nothing", async () => {
    // Setup
    const generate = vi.fn().mockRejectedValue(new Error("boom"));
    const countHits = makeCountHits({ FORE: 5 });

    // Act
    const result = await generateAndProbeCandidates(
      { ...baseInput, generate },
      { probeDeps: { countHits: countHits as never } },
    );

    // Assert: a failed call leaves every intent short, so the loop retries until
    // the attempt cap rather than accepting an empty query set.
    expect(result.attempts).toBe(GENERATION_MAX_ATTEMPTS);
    expect(result.survivors).toEqual([]);
    expect(result.dropped).toEqual([]);
    expect(countHits).not.toHaveBeenCalled();
  });
});
