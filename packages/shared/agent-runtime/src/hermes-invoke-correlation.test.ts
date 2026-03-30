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

  it("includes agentJobId when X-Job-Id header is present", () => {
    const getHeader = (name: string): string | undefined => {
      if (name === HERMES_HEADER_JOB_ID) return "job-abc-123";
      return undefined;
    };

    const result = hermesInvokeCorrelationFromGetHeader(getHeader);

    expect(result).toEqual({ agentJobId: "job-abc-123" });
  });

  it("trims agentJobId whitespace", () => {
    const getHeader = (name: string): string | undefined => {
      if (name === HERMES_HEADER_JOB_ID) return "  job-xyz  ";
      return undefined;
    };

    const result = hermesInvokeCorrelationFromGetHeader(getHeader);

    expect(result).toEqual({ agentJobId: "job-xyz" });
  });

  it("includes all four correlation fields when all headers are set", () => {
    const getHeader = (name: string): string | undefined => {
      if (name === HERMES_HEADER_SCHEDULE_ID) return "s1";
      if (name === HERMES_HEADER_SCHEDULE_EXECUTION_ID) return "se1";
      if (name === HERMES_HEADER_PIPELINE_STEP_ID) return "p1";
      if (name === HERMES_HEADER_JOB_ID) return "j1";
      return undefined;
    };

    const result = hermesInvokeCorrelationFromGetHeader(getHeader);

    expect(result).toEqual({
      scheduleId: "s1",
      scheduleExecutionId: "se1",
      pipelineStepId: "p1",
      agentJobId: "j1",
    });
  });

  it("returns undefined when no usable header values remain", () => {
    const getHeader = (name: string): string | undefined => {
      if (name === HERMES_HEADER_SCHEDULE_ID) return "   ";
      return undefined;
    };

    expect(hermesInvokeCorrelationFromGetHeader(getHeader)).toBeUndefined();
  });

  it("returns undefined when all headers are absent", () => {
    const getHeader = (_name: string): string | undefined => undefined;

    expect(hermesInvokeCorrelationFromGetHeader(getHeader)).toBeUndefined();
  });
});
