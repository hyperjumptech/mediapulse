/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { buildDeterministicBaseline } from "./deterministic-baseline.js";

const baseCtx = {
  ticker: {
    id: "11111111-1111-4111-a111-111111111111",
    symbol: "ACME",
    name: "Acme Corp",
    metadata: null,
  },
  topEntities: [
    {
      canonicalName: "Roadrunner LLC",
      typeName: "Company",
      relevanceWeight: 0.9,
    },
  ],
  configSnapshot: {
    queryCount: 10,
    allowedLanguages: ["en"],
    minDeterministicCount: 5,
    weightBreaking: 0.5,
    weightKgChange: 0.3,
    weightFundamental: 0.2,
    model: "gpt-4o-mini",
    maxTokens: 500,
  },
};

describe("buildDeterministicBaseline", () => {
  it("returns at least minDeterministicCount deterministic rows", () => {
    const rows = buildDeterministicBaseline(baseCtx);

    expect(rows.length).toBeGreaterThanOrEqual(
      baseCtx.configSnapshot.minDeterministicCount,
    );
    expect(rows.every((r) => r.source === "deterministic")).toBe(true);
  });

  it("includes template and top-entity derived strings", () => {
    const rows = buildDeterministicBaseline(baseCtx);
    const texts = rows.map((r) => r.text);

    expect(texts.some((t) => t.includes("ACME") && t.includes("latest"))).toBe(
      true,
    );
    expect(texts.some((t) => t.includes("Roadrunner"))).toBe(true);
  });
});
