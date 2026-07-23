/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { GENERATION_MAX_ATTEMPTS } from "../constants";
import { generateCandidatesWithCoverage } from "./generate-with-coverage";

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

describe("generateCandidatesWithCoverage", () => {
  it("stops after the first attempt when every intent meets its quota", async () => {
    // Setup
    const generate = makeGenerate([onePerIntent("q")]);

    // Act
    const result = await generateCandidatesWithCoverage({
      ...baseInput,
      generate,
    });

    // Assert
    expect(result.attempts).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.candidates).toHaveLength(ALL_INTENTS.length);
  });

  it("retries while an intent is short", async () => {
    // Setup: attempt 1 covers only one intent.
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

    // Act
    const result = await generateCandidatesWithCoverage({
      ...baseInput,
      generate,
    });

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

    // Act
    await generateCandidatesWithCoverage({ ...baseInput, generate });

    // Assert
    const secondPrompt = String(generate.mock.calls[1]![0].prompt);

    expect(secondPrompt).toContain("under-filled these intents");
    expect(secondPrompt).toContain("industryPulse");
    expect(secondPrompt).not.toContain("regulatoryPolicyWatch: ");
  });

  it("dedupes candidates across attempts", async () => {
    // Setup: attempt 1 fills only one intent; attempt 2 repeats it plus fills the rest.
    const generate = makeGenerate([
      [
        {
          intent: "regulatoryPolicyWatch",
          language: "id",
          text: "saham FORE IDX",
        },
      ],
      [
        {
          intent: "regulatoryPolicyWatch",
          language: "id",
          text: "saham FORE IDX",
        },
        ...onePerIntent("q"),
      ],
    ]);

    // Act
    const result = await generateCandidatesWithCoverage({
      ...baseInput,
      generate,
    });

    // Assert: the repeated query appears once.
    const occurrences = result.candidates.filter(
      (candidate) => candidate.text === "saham FORE IDX",
    );

    expect(occurrences).toHaveLength(1);
  });

  it("stops after GENERATION_MAX_ATTEMPTS even when intents stay short", async () => {
    // Setup
    const generate = makeGenerate([
      [{ intent: "regulatoryPolicyWatch", language: "id", text: "a" }],
      [{ intent: "regulatoryPolicyWatch", language: "id", text: "b" }],
      [{ intent: "regulatoryPolicyWatch", language: "id", text: "c" }],
    ]);

    // Act
    const result = await generateCandidatesWithCoverage({
      ...baseInput,
      generate,
    });

    // Assert
    expect(result.attempts).toBe(GENERATION_MAX_ATTEMPTS);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(result.candidates.map((candidate) => candidate.text).sort()).toEqual(
      ["a", "b", "c"],
    );
  });

  it("retries a failing generation call up to the attempt cap, then yields nothing", async () => {
    // Setup
    const generate = vi.fn().mockRejectedValue(new Error("boom"));

    // Act
    const result = await generateCandidatesWithCoverage({
      ...baseInput,
      generate,
    });

    // Assert: a failed call leaves every intent short, so the loop retries until
    // the attempt cap rather than accepting an empty query set.
    expect(result.attempts).toBe(GENERATION_MAX_ATTEMPTS);
    expect(result.candidates).toEqual([]);
  });
});
