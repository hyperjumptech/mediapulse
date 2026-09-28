import { describe, expect, it } from "vitest";

import {
  buildProcessedUrlAgentWhere,
  buildProcessedUrlGateStatusWhere,
  buildProcessedUrlListWhere,
} from "./list-filters";

describe("buildProcessedUrlListWhere", () => {
  it("returns an empty filter when no inputs are set", () => {
    expect(buildProcessedUrlListWhere({})).toEqual({});
  });

  it("filters by scheduleExecutionId", () => {
    expect(
      buildProcessedUrlListWhere({
        scheduleExecutionId: "11111111-1111-4111-a111-111111111111",
      }),
    ).toEqual({
      scheduleExecutionId: "11111111-1111-4111-a111-111111111111",
    });
  });

  it("filters a subject by its ticker id", () => {
    expect(
      buildProcessedUrlListWhere({
        subjectId: "33333333-3333-4333-a333-333333333333",
      }),
    ).toEqual({ tickerId: "33333333-3333-4333-a333-333333333333" });
  });

  it("maps a known agent id to the collection agent", () => {
    expect(buildProcessedUrlListWhere({ agent: "page-collection" })).toEqual({
      agent: "page_collection",
    });
  });

  it("matches nothing for an agent that records no processed URLs", () => {
    expect(buildProcessedUrlListWhere({ agent: "delivery" })).toEqual({
      id: { in: [] },
    });
  });

  it("maps gateStatus passed to collected outcomes", () => {
    expect(buildProcessedUrlListWhere({ gateStatus: "passed" })).toEqual({
      status: "collected",
    });
  });

  it("maps gateStatus failed to dropped or failed outcomes", () => {
    expect(buildProcessedUrlListWhere({ gateStatus: "failed" })).toEqual({
      status: { in: ["dropped", "failed"] },
    });
  });

  it("combines curatedSourceId and gateStatus under AND", () => {
    expect(
      buildProcessedUrlListWhere({
        curatedSourceId: "22222222-2222-4222-a222-222222222222",
        gateStatus: "passed",
      }),
    ).toEqual({
      AND: [
        { curatedSourceId: "22222222-2222-4222-a222-222222222222" },
        { status: "collected" },
      ],
    });
  });
});

describe("buildProcessedUrlGateStatusWhere", () => {
  it("returns collected for passed", () => {
    expect(buildProcessedUrlGateStatusWhere("passed")).toEqual({
      status: "collected",
    });
  });
});

describe("buildProcessedUrlAgentWhere", () => {
  it("maps data-collection to its collection agent", () => {
    expect(buildProcessedUrlAgentWhere("data-collection")).toEqual({
      agent: "data_collection",
    });
  });

  it("matches nothing for an unknown agent", () => {
    expect(buildProcessedUrlAgentWhere("content-generation")).toEqual({
      id: { in: [] },
    });
  });
});
