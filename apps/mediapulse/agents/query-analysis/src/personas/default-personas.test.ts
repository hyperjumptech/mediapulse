/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS } from "@workspace/agent-data-api-contract";

import {
  DEFAULT_QUERY_PERSONAS,
  personaIntentMergeWeight,
  resolveQueryPersonas,
} from "./default-personas";

describe("DEFAULT_QUERY_PERSONAS", () => {
  it("defines five personas with unique ids", () => {
    const ids = DEFAULT_QUERY_PERSONAS.map((p) => p.id);
    expect(ids).toEqual([
      "analyst",
      "retail",
      "regulator",
      "esg",
      "short_seller",
    ]);
    expect(new Set(ids).size).toBe(5);
  });
});

describe("resolveQueryPersonas", () => {
  it("returns personas in config order and skips unknown ids", () => {
    const warn = vi.fn();
    const resolved = resolveQueryPersonas(["retail", "nope", "analyst"], {
      warn,
    });
    expect(resolved.map((p) => p.id)).toEqual(["retail", "analyst"]);
    expect(warn).toHaveBeenCalledWith(
      "unknown query-analysis persona id; skipping",
      { unknownId: "nope" },
    );
  });

  it("returns an empty array when every id is unknown", () => {
    const resolved = resolveQueryPersonas(["missing"]);
    expect(resolved).toEqual([]);
  });
});

describe("personaIntentMergeWeight", () => {
  it("multiplies base strategy weight by persona intent bias", () => {
    const regulator = DEFAULT_QUERY_PERSONAS.find((p) => p.id === "regulator");
    expect(regulator).toBeDefined();
    const weight = personaIntentMergeWeight("fundamental", regulator!, {
      ...DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
      fundamental: 0.6,
    });
    expect(weight).toBeCloseTo(0.6 * 1.5);
  });
});
