/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  HERMES_HEADER_EXECUTION_ID,
  HERMES_HEADER_JOB_ID,
  HERMES_HEADER_PIPELINE_STEP_ID,
  HERMES_HEADER_SCHEDULE_EXECUTION_ID,
  HERMES_HEADER_SCHEDULE_ID,
  hermesInvokeCorrelationFromGetHeader,
} from "./hermes-invoke-correlation.js";

describe("hermesInvokeCorrelationFromGetHeader", () => {
  it("returns spreadable keys only for non-empty trimmed header values", () => {
    const getHeader = (name: string): string | undefined => {
      if (name === HERMES_HEADER_JOB_ID) return "job-1";
      if (name === HERMES_HEADER_EXECUTION_ID) return "ex-1";
      if (name === HERMES_HEADER_SCHEDULE_ID) return "  s1  ";
      if (name === HERMES_HEADER_SCHEDULE_EXECUTION_ID) return "se1";
      if (name === HERMES_HEADER_PIPELINE_STEP_ID) return "p1";
      return undefined;
    };

    const result = hermesInvokeCorrelationFromGetHeader(getHeader);

    expect(result).toEqual({
      jobId: "job-1",
      executionId: "ex-1",
      scheduleId: "s1",
      scheduleExecutionId: "se1",
      pipelineStepId: "p1",
    });
  });

  it("returns correlation when only X-Job-Id is present", () => {
    const getHeader = (name: string): string | undefined =>
      name === HERMES_HEADER_JOB_ID ? "j-only" : undefined;

    expect(hermesInvokeCorrelationFromGetHeader(getHeader)).toEqual({
      jobId: "j-only",
    });
  });

  it("returns undefined when no usable header values remain", () => {
    const getHeader = (name: string): string | undefined => {
      if (name === HERMES_HEADER_SCHEDULE_ID) return "   ";
      return undefined;
    };

    expect(hermesInvokeCorrelationFromGetHeader(getHeader)).toBeUndefined();
  });

  it("returns correlation when only X-Job-Id is set", () => {
    const getHeader = (name: string): string | undefined =>
      name === HERMES_HEADER_JOB_ID ? "j-only" : undefined;

    expect(hermesInvokeCorrelationFromGetHeader(getHeader)).toEqual({
      jobId: "j-only",
    });
  });
});
