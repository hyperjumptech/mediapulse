/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  collectDataSourceExpansionTemplateIdsFromPipelineSteps,
  getExpansionDisplayNamesForPipeline,
} from "./pipeline-expansion-display-names";

describe("collectDataSourceExpansionTemplateIdsFromPipelineSteps", () => {
  it("returns empty when there are no steps", () => {
    expect(collectDataSourceExpansionTemplateIdsFromPipelineSteps([])).toEqual(
      [],
    );
  });

  it("collects unique ids from step input values", () => {
    const id = "4e2c7bed-a841-44c2-b925-8634cba9cb77";
    const steps = [
      { input: { tickerId: `{{dse:${id}}}` } },
      { input: { other: `{{dse:${id}}}` } },
    ];
    expect(
      collectDataSourceExpansionTemplateIdsFromPipelineSteps(steps),
    ).toEqual([id]);
  });

  it("skips steps without object input", () => {
    expect(
      collectDataSourceExpansionTemplateIdsFromPipelineSteps([
        { input: null },
        { input: [] },
        { input: "x" },
      ]),
    ).toEqual([]);
  });
});

describe("getExpansionDisplayNamesForPipeline", () => {
  it("returns empty and does not query when template ids are empty", async () => {
    const findMany = vi.fn();
    const result = await getExpansionDisplayNamesForPipeline("di-1", [], {
      db: { findMany },
    });
    expect(result).toEqual({});
    expect(findMany).not.toHaveBeenCalled();
  });

  it("maps template ids to names for the domain integration", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "a", name: "One" },
      { id: "b", name: "Two" },
    ]);
    const result = await getExpansionDisplayNamesForPipeline(
      "di-1",
      ["a", "b"],
      { db: { findMany } },
    );
    expect(result).toEqual({ a: "One", b: "Two" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          domainIntegrationId: "di-1",
          id: { in: ["a", "b"] },
        },
        select: { id: true, name: true },
      }),
    );
  });
});
