/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const requireDashboardAdminMock = vi.fn();
const agentJobExecutionFindFirstMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  requireDashboardAdmin: () => requireDashboardAdminMock(),
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    agentJobExecution: {
      findFirst: (...args: unknown[]) =>
        agentJobExecutionFindFirstMock(...args),
    },
  },
}));

import { SECRET_MASK } from "@/lib/mask-json-secrets";

import {
  fetchInvocationPayloadAction,
  type InvocationPayloadRequest,
} from "./invocation-payload-actions";

const payloadSelect = {
  params: true,
  invocationConfig: true,
  error: true,
  agentResponse: true,
};

const storedJob = {
  params: { ticker: "ABC", apiKey: "secret-key" },
  invocationConfig: { endpoint: "https://agent", token: "secret-token" },
  error: { message: "upstream failed" },
  agentResponse: { status: "failure", message: "no sources" },
};

describe("fetchInvocationPayloadAction", () => {
  afterEach(() => {
    requireDashboardAdminMock.mockReset();
    agentJobExecutionFindFirstMock.mockReset();
  });

  it("rejects callers who are not active admins", async () => {
    // Setup
    requireDashboardAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    // Act
    const pending = fetchInvocationPayloadAction({
      kind: "schedule",
      parentId: "sched-1",
      executionId: "exec-1",
      jobId: "job-1",
    });

    // Assert
    await expect(pending).rejects.toThrow("NEXT_REDIRECT");
    expect(agentJobExecutionFindFirstMock).not.toHaveBeenCalled();
  });

  it("scopes a schedule job lookup to the schedule execution and schedule", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue({ id: "u1" });
    agentJobExecutionFindFirstMock.mockResolvedValue(storedJob);

    // Act
    await fetchInvocationPayloadAction({
      kind: "schedule",
      parentId: "sched-1",
      executionId: "exec-1",
      jobId: "job-1",
    });

    // Assert
    expect(agentJobExecutionFindFirstMock).toHaveBeenCalledWith({
      where: {
        jobId: "job-1",
        scheduleExecutionId: "exec-1",
        scheduleExecution: { scheduleId: "sched-1" },
      },
      select: payloadSelect,
    });
  });

  it("scopes an HTTP trigger job lookup to the trigger execution and trigger", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue({ id: "u1" });
    agentJobExecutionFindFirstMock.mockResolvedValue(storedJob);

    // Act
    await fetchInvocationPayloadAction({
      kind: "httpTrigger",
      parentId: "trigger-1",
      executionId: "exec-2",
      jobId: "job-2",
    });

    // Assert
    expect(agentJobExecutionFindFirstMock).toHaveBeenCalledWith({
      where: {
        jobId: "job-2",
        httpTriggerExecutionId: "exec-2",
        httpTriggerExecution: { httpTriggerId: "trigger-1" },
      },
      select: payloadSelect,
    });
  });

  it("scopes a manual job lookup to the manual execution and pipeline", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue({ id: "u1" });
    agentJobExecutionFindFirstMock.mockResolvedValue(storedJob);

    // Act
    await fetchInvocationPayloadAction({
      kind: "manual",
      parentId: "pipe-1",
      executionId: "exec-3",
      jobId: "job-3",
    });

    // Assert
    expect(agentJobExecutionFindFirstMock).toHaveBeenCalledWith({
      where: {
        jobId: "job-3",
        manualExecutionId: "exec-3",
        manualExecution: { pipelineId: "pipe-1" },
      },
      select: payloadSelect,
    });
  });

  it("masks secrets in the input and config before returning them", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue({ id: "u1" });
    agentJobExecutionFindFirstMock.mockResolvedValue(storedJob);

    // Act
    const payload = await fetchInvocationPayloadAction({
      kind: "schedule",
      parentId: "sched-1",
      executionId: "exec-1",
      jobId: "job-1",
    });

    // Assert
    expect(payload).toEqual({
      inputMasked: { ticker: "ABC", apiKey: SECRET_MASK },
      configMasked: { endpoint: "https://agent", token: SECRET_MASK },
      transportError: { message: "upstream failed" },
      agentResponse: { status: "failure", message: "no sources" },
    });
  });

  it("keeps a missing config as null", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue({ id: "u1" });
    agentJobExecutionFindFirstMock.mockResolvedValue({
      ...storedJob,
      invocationConfig: null,
    });

    // Act
    const payload = await fetchInvocationPayloadAction({
      kind: "manual",
      parentId: "pipe-1",
      executionId: "exec-3",
      jobId: "job-3",
    });

    // Assert
    expect(payload?.configMasked).toBeNull();
  });

  it("returns null when no job matches the scope", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue({ id: "u1" });
    agentJobExecutionFindFirstMock.mockResolvedValue(null);

    // Act
    const payload = await fetchInvocationPayloadAction({
      kind: "httpTrigger",
      parentId: "trigger-1",
      executionId: "exec-2",
      jobId: "job-from-another-execution",
    });

    // Assert
    expect(payload).toBeNull();
  });

  it.each([
    {
      label: "an unknown kind",
      input: {
        kind: "domainIntegration",
        parentId: "p",
        executionId: "e",
        jobId: "j",
      },
    },
    {
      label: "an empty job id",
      input: { kind: "schedule", parentId: "p", executionId: "e", jobId: "" },
    },
    {
      label: "a missing execution id",
      input: { kind: "manual", parentId: "p", jobId: "j" },
    },
    {
      label: "a non-string parent id",
      input: { kind: "schedule", parentId: 42, executionId: "e", jobId: "j" },
    },
  ])("rejects $label without querying", async ({ input }) => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue({ id: "u1" });

    // Act
    const pending = fetchInvocationPayloadAction(
      input as unknown as InvocationPayloadRequest,
    );

    // Assert
    await expect(pending).rejects.toThrow();
    expect(agentJobExecutionFindFirstMock).not.toHaveBeenCalled();
  });
});
