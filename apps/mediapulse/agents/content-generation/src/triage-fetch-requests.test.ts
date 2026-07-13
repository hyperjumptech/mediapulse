/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { ContentGenerationConfigSchema } from "./config-schema.js";
import {
  triageFetchRequests,
  type TriageCandidateSource,
  type TriageObjectFn,
} from "./triage-fetch-requests.js";

const config = ContentGenerationConfigSchema.parse({
  model: { apiKey: "sk-test", model: "gpt-4o" },
});

const candidates: TriageCandidateSource[] = [
  {
    dataSourceId: "11111111-1111-4111-a111-111111111111",
    title: "Thin headline",
    description: "Bare headline",
    section: "quickHits",
    sectionScore: 0.8,
  },
  {
    dataSourceId: "22222222-2222-4222-a222-222222222222",
    title: "Detailed story",
    description: "Full concrete facts already present.",
    section: "dealsAndMovements",
    sectionScore: 0.6,
  },
];

describe("triageFetchRequests", () => {
  it("returns the model-requested fetch list", async () => {
    const generateObjectFn: TriageObjectFn = vi.fn().mockResolvedValue({
      object: {
        fetchRequests: [
          {
            dataSourceId: "11111111-1111-4111-a111-111111111111",
            reason: "description is a bare headline",
          },
        ],
      },
    });

    const result = await triageFetchRequests(
      candidates,
      config,
      { tickerId: "ticker-1", tickerName: "Test", tickerSymbol: "TST" },
      { generateObjectFn },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.dataSourceId).toBe(
      "11111111-1111-4111-a111-111111111111",
    );
    expect(generateObjectFn).toHaveBeenCalledTimes(1);
  });

  it("drops requests whose id is not among the candidates", async () => {
    const generateObjectFn: TriageObjectFn = vi.fn().mockResolvedValue({
      object: {
        fetchRequests: [
          {
            dataSourceId: "99999999-9999-4999-a999-999999999999",
            reason: "hallucinated id",
          },
          {
            dataSourceId: "22222222-2222-4222-a222-222222222222",
            reason: "actually thin",
          },
        ],
      },
    });

    const result = await triageFetchRequests(
      candidates,
      config,
      { tickerId: "ticker-1" },
      { generateObjectFn },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.dataSourceId).toBe(
      "22222222-2222-4222-a222-222222222222",
    );
  });

  it("returns an empty list without calling the model when there are no candidates", async () => {
    const generateObjectFn: TriageObjectFn = vi.fn();

    const result = await triageFetchRequests(
      [],
      config,
      { tickerId: "ticker-1" },
      { generateObjectFn },
    );

    expect(result).toEqual([]);
    expect(generateObjectFn).not.toHaveBeenCalled();
  });

  it("dedupes repeated ids in the model output", async () => {
    const generateObjectFn: TriageObjectFn = vi.fn().mockResolvedValue({
      object: {
        fetchRequests: [
          {
            dataSourceId: "11111111-1111-4111-a111-111111111111",
            reason: "thin",
          },
          {
            dataSourceId: "11111111-1111-4111-a111-111111111111",
            reason: "thin again",
          },
        ],
      },
    });

    const result = await triageFetchRequests(
      candidates,
      config,
      { tickerId: "ticker-1" },
      { generateObjectFn },
    );

    expect(result).toHaveLength(1);
  });
});
