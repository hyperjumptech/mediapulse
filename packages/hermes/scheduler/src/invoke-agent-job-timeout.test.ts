import { describe, expect, it } from "vitest";

import {
  DEFAULT_INVOKE_AGENT_JOB_TIMEOUT_MS,
  resolveInvokeAgentJobTimeoutMs,
} from "./invoke-agent-job-timeout";

describe("resolveInvokeAgentJobTimeoutMs", () => {
  it("returns the agent timeout when it is below the default cap", () => {
    expect(resolveInvokeAgentJobTimeoutMs(60_000)).toBe(60_000);
  });

  it("clamps to the default cap when the agent timeout is larger", () => {
    expect(resolveInvokeAgentJobTimeoutMs(10_800_000)).toBe(
      DEFAULT_INVOKE_AGENT_JOB_TIMEOUT_MS,
    );
  });

  it("honors an explicit cap override", () => {
    expect(resolveInvokeAgentJobTimeoutMs(7_200_000, 1_800_000)).toBe(
      1_800_000,
    );
  });
});
