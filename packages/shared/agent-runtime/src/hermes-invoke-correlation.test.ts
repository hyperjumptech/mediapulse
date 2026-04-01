/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  HERMES_HEADER_JOB_ID,
  HERMES_HEADER_PIPELINE_STEP_ID,
  HERMES_HEADER_SCHEDULE_EXECUTION_ID,
  HERMES_HEADER_SCHEDULE_ID,
  hermesInvokeCorrelationFromGetHeader,
} from "./hermes-invoke-correlation.js";

describe("hermesInvokeCorrelationFromGetHeader", () => {
  it("returns spreadable keys only for non-empty trimmed header values", () => {
    const getHeader = (name: string): string | undefined => {
      if (name === HERMES_HEADER_SCHEDULE_ID) return "  s1  ";
      if (name === HERMES_HEADER_SCHEDULE_EXECUTION_ID) return "se1";
      if (name === HERMES_HEADER_PIPELINE_STEP_ID) return "p1";
      return undefined;
    };

    const result = hermesInvokeCorrelationFromGetHeader(getHeader);

    expect(result).toEqual({
      scheduleId: "s1",
      scheduleExecutionId: "se1",
      pipelineStepId: "p1",
    });
  });

  it("returns undefined when no usable header values remain", () => {
    const getHeader = (name: string): string | undefined => {
      if (name === HERMES_HEADER_SCHEDULE_ID) return "   ";
      return undefined;
    };

    expect(hermesInvokeCorrelationFromGetHeader(getHeader)).toBeUndefined();
  });

  it("returns jobId when only X-Job-Id is present", () => {
    const getHeader = (name: string): string | undefined =>
      name === HERMES_HEADER_JOB_ID ? "job-exec-1" : undefined;

    expect(hermesInvokeCorrelationFromGetHeader(getHeader)).toEqual({
      jobId: "job-exec-1",
    });
  });
});
