import { describe, expect, it, vi } from "vitest";

import {
  buildHermesLinks,
  type BuildHermesLinksDeps,
} from "./build-hermes-links";

const makeDeps = (
  overrides: Partial<BuildHermesLinksDeps>,
): BuildHermesLinksDeps => ({
  contentGenerationRun: {
    findFirst: vi.fn().mockResolvedValue(null),
  },
  deliveryRun: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  ...overrides,
});

describe("buildHermesLinks", () => {
  it("returns nulls and empty arrays when nothing is linked", async () => {
    const result = await buildHermesLinks("nl-x", makeDeps({}));

    expect(result).toStrictEqual({
      contentGenerationRunId: null,
      pipelineRunId: null,
      hermesExecutionId: null,
      hermesScheduleId: null,
      scheduleExecutionId: null,
      pipelineStepId: null,
      jobIds: [],
      deliveryRunIds: [],
    });
  });

  it("populates schedule/execution/pipelineStep from the latest delivery run", async () => {
    const deps = makeDeps({
      contentGenerationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: "cgr-1",
          pipelineRunId: "pr-1",
          executionId: "ex-cgr",
        }),
      },
      deliveryRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "dr-latest",
            hermesScheduleId: "sch-1",
            scheduleExecutionId: "sex-1",
            hermesExecutionId: "ex-latest",
            pipelineStepId: "step-1",
            jobId: "job-1",
          },
          {
            id: "dr-older",
            hermesScheduleId: "sch-1",
            scheduleExecutionId: "sex-0",
            hermesExecutionId: "ex-older",
            pipelineStepId: "step-0",
            jobId: "job-2",
          },
        ]),
      },
    });

    const result = await buildHermesLinks("nl-1", deps);

    expect(result.contentGenerationRunId).toBe("cgr-1");
    expect(result.pipelineRunId).toBe("pr-1");
    expect(result.hermesScheduleId).toBe("sch-1");
    expect(result.scheduleExecutionId).toBe("sex-1");
    expect(result.hermesExecutionId).toBe("ex-latest");
    expect(result.pipelineStepId).toBe("step-1");
    expect(result.jobIds).toStrictEqual(["job-1", "job-2"]);
    expect(result.deliveryRunIds).toStrictEqual(["dr-latest", "dr-older"]);
  });

  it("falls back to the content-generation execution id when delivery has none", async () => {
    const deps = makeDeps({
      contentGenerationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: "cgr-1",
          pipelineRunId: "pr-1",
          executionId: "ex-cgr",
        }),
      },
      deliveryRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "dr-only",
            hermesScheduleId: null,
            scheduleExecutionId: null,
            hermesExecutionId: null,
            pipelineStepId: null,
            jobId: null,
          },
        ]),
      },
    });

    const result = await buildHermesLinks("nl-1", deps);

    expect(result.hermesExecutionId).toBe("ex-cgr");
    expect(result.jobIds).toStrictEqual([]);
  });

  it("de-duplicates jobIds across runs", async () => {
    const deps = makeDeps({
      deliveryRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "dr-1",
            hermesScheduleId: null,
            scheduleExecutionId: null,
            hermesExecutionId: null,
            pipelineStepId: null,
            jobId: "job-a",
          },
          {
            id: "dr-2",
            hermesScheduleId: null,
            scheduleExecutionId: null,
            hermesExecutionId: null,
            pipelineStepId: null,
            jobId: "job-a",
          },
          {
            id: "dr-3",
            hermesScheduleId: null,
            scheduleExecutionId: null,
            hermesExecutionId: null,
            pipelineStepId: null,
            jobId: "job-b",
          },
        ]),
      },
    });

    const result = await buildHermesLinks("nl-1", deps);

    expect(result.jobIds).toStrictEqual(["job-a", "job-b"]);
  });
});
