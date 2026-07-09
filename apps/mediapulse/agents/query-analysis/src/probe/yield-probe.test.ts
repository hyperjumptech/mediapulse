/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import type {
  CountQueryHitsContext,
  ProviderEntry,
} from "@workspace/agent-search";

import type { Candidate } from "../pipeline/types";
import {
  capToBudget,
  dedupeCandidates,
  normalizeQueryText,
  runYieldProbe,
  stagePriorityForIntent,
} from "./yield-probe";

const providers: ProviderEntry[] = [{ provider: "serper", apiKey: "k" }];

const candidate = (
  text: string,
  intent: Candidate["intent"],
  language: Candidate["language"] = "id",
): Candidate => ({ text, intent, language });

const fakeCreateProvider = () =>
  vi.fn(() => ({ type: "serper" as const, search: vi.fn() }));

const fakeCountHits = (hitsByText: Record<string, number>) =>
  vi.fn(async (text: string, context: CountQueryHitsContext) => {
    if (context.creditsSink) {
      context.creditsSink.credits += 2;
    }

    return { hits: hitsByText[text] ?? 0, credits: 2, provider: "serper" };
  });

describe("normalizeQueryText", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeQueryText("  Bank   Mandiri  ")).toBe("bank mandiri");
  });
});

describe("dedupeCandidates", () => {
  it("keeps the first occurrence per normalized text", () => {
    const deduped = dedupeCandidates([
      candidate("Bank Mandiri", "competitor"),
      candidate("bank mandiri", "competitor", "en"),
      candidate("OJK", "regulatory"),
    ]);
    expect(deduped.map((c) => c.text)).toEqual(["Bank Mandiri", "OJK"]);
  });
});

describe("stagePriorityForIntent / capToBudget", () => {
  it("orders own-company > competitor > regulator > industry", () => {
    expect(stagePriorityForIntent("breaking")).toBe(0);
    expect(stagePriorityForIntent("competitor")).toBe(1);
    expect(stagePriorityForIntent("regulatory")).toBe(2);
    expect(stagePriorityForIntent("industry_trend")).toBe(3);
  });

  it("caps to budget by stage priority", () => {
    const capped = capToBudget(
      [
        candidate("theme", "industry_trend"),
        candidate("BBRI", "breaking"),
        candidate("Bank Mandiri", "competitor"),
      ],
      2,
    );
    expect(capped.map((c) => c.text)).toEqual(["BBRI", "Bank Mandiri"]);
  });
});

describe("runYieldProbe", () => {
  it("drops zero-yield candidates and ranks survivors by hits", async () => {
    // Setup
    const countHits = fakeCountHits({ BBRI: 10, "Bank Mandiri": 3 });
    const deps = {
      countHits: countHits as never,
      createProvider: fakeCreateProvider() as never,
    };

    // Act
    const result = await runYieldProbe(
      {
        candidates: [
          candidate("BBRI", "breaking"),
          candidate("Bank Mandiri", "competitor"),
          candidate("dead query", "industry_trend"),
        ],
        providers,
        locales: [{ gl: "id", hl: "id" }],
        budget: 80,
        concurrency: 4,
        minResults: 1,
        timeoutMs: 1000,
      },
      deps,
    );

    // Assert
    expect(result.survivors.map((s) => s.text)).toEqual([
      "BBRI",
      "Bank Mandiri",
    ]);
    expect(result.survivors[0]?.rank).toBe(1);
    expect(result.dropped.map((d) => d.text)).toEqual(["dead query"]);
    expect(result.telemetry.searchCredits).toBe(6);
    expect(result.telemetry.providerUsage[0]?.name).toBe("serper");
  });

  it("keeps candidates whose probe failed instead of dropping them as zero-yield", async () => {
    // Setup
    const countHits = vi.fn(async (text: string) =>
      text === "provider down"
        ? { hits: 0, credits: 0, failed: true }
        : { hits: 4, credits: 2, provider: "serper" },
    );
    const deps = {
      countHits: countHits as never,
      createProvider: fakeCreateProvider() as never,
    };

    // Act
    const result = await runYieldProbe(
      {
        candidates: [
          candidate("provider down", "industry_trend"),
          candidate("BBRI", "breaking"),
        ],
        providers,
        locales: [{ gl: "id", hl: "id" }],
        budget: 80,
        concurrency: 2,
        minResults: 1,
        timeoutMs: 1000,
      },
      deps,
    );

    // Assert
    expect(result.survivors.map((s) => s.text).sort()).toEqual([
      "BBRI",
      "provider down",
    ]);
    expect(result.dropped).toEqual([]);
  });

  it("resolves a hung candidate via the deadline instead of stalling the probe", async () => {
    // Setup
    vi.useFakeTimers();
    const countHits = vi.fn(() => new Promise(() => undefined) as never);
    const deps = {
      countHits: countHits as never,
      createProvider: fakeCreateProvider() as never,
    };

    // Act
    const probe = runYieldProbe(
      {
        candidates: [
          candidate("hung query", "breaking"),
          candidate("BBRI", "breaking"),
        ],
        providers,
        locales: [{ gl: "id", hl: "id" }],
        budget: 80,
        concurrency: 4,
        minResults: 1,
        timeoutMs: 1000,
      },
      deps,
    );
    await vi.advanceTimersByTimeAsync(2000);
    const result = await probe;
    vi.useRealTimers();

    // Assert
    expect(result.survivors.map((survivor) => survivor.text).sort()).toEqual([
      "BBRI",
      "hung query",
    ]);
    expect(result.dropped).toEqual([]);
  });

  it("respects the probe budget by admitting only the highest-priority candidates", async () => {
    // Setup
    const countHits = fakeCountHits({ BBRI: 5, "Bank Mandiri": 5, theme: 5 });
    const deps = {
      countHits: countHits as never,
      createProvider: fakeCreateProvider() as never,
    };

    // Act
    const result = await runYieldProbe(
      {
        candidates: [
          candidate("theme", "industry_trend"),
          candidate("BBRI", "breaking"),
          candidate("Bank Mandiri", "competitor"),
        ],
        providers,
        locales: [{ gl: "id", hl: "id" }],
        budget: 2,
        concurrency: 2,
        minResults: 1,
        timeoutMs: 1000,
      },
      deps,
    );

    // Assert
    expect(countHits).toHaveBeenCalledTimes(2);
    expect(result.telemetry.candidates).toBe(3);
    expect(result.survivors.map((s) => s.text).sort()).toEqual([
      "BBRI",
      "Bank Mandiri",
    ]);
  });
});
