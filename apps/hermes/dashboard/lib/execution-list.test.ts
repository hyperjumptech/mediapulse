import { describe, expect, it } from "vitest";

import {
  executionCancelTarget,
  executionDetailHref,
  executionSourceHref,
} from "./execution-list";

describe("execution list links", () => {
  it.each([
    [
      "schedule",
      "/dashboard/schedules/parent/executions/run",
      "/dashboard/schedules/parent",
    ],
    [
      "http-trigger",
      "/dashboard/http-triggers/parent/executions/run",
      "/dashboard/http-triggers/parent",
    ],
    ["manual", "/dashboard/pipelines/parent/executions/run", null],
  ] as const)("builds %s links", (source, detailHref, sourceHref) => {
    const row = { id: "run", source, sourceId: "parent" };

    expect(executionDetailHref(row)).toBe(detailHref);
    expect(executionSourceHref(row)).toBe(sourceHref);
  });
});

describe("executionCancelTarget", () => {
  it.each([
    [
      "schedule",
      { kind: "schedule", scheduleId: "parent", scheduleExecutionId: "run" },
    ],
    [
      "http-trigger",
      {
        kind: "httpTrigger",
        httpTriggerId: "parent",
        httpTriggerExecutionId: "run",
      },
    ],
    [
      "manual",
      { kind: "manual", pipelineId: "parent", manualExecutionId: "run" },
    ],
  ] as const)("targets a %s run", (source, target) => {
    expect(
      executionCancelTarget({ id: "run", source, sourceId: "parent" }),
    ).toEqual(target);
  });
});
