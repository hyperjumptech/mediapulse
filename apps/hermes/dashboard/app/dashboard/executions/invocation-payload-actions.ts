"use server";

import { z } from "zod";

import type { Prisma } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";

import { maskInvocationPayloadForDisplay } from "@/lib/mask-json-secrets";
import { requireDashboardAdmin } from "@/lib/require-dashboard-admin";

const invocationPayloadRequestSchema = z.object({
  kind: z.enum(["schedule", "httpTrigger", "manual"]),
  parentId: z.string().min(1),
  executionId: z.string().min(1),
  jobId: z.string().min(1),
});

export type InvocationPayloadRequest = z.infer<
  typeof invocationPayloadRequestSchema
>;

export type InvocationPayloadSource = Omit<InvocationPayloadRequest, "jobId">;

export type InvocationPayload = {
  inputMasked: unknown;
  configMasked: unknown | null;
  transportError: unknown | null;
  agentResponse: unknown | null;
};

const invocationPayloadWhere = (
  request: InvocationPayloadRequest,
): Prisma.AgentJobExecutionWhereInput => {
  if (request.kind === "schedule") {
    return {
      jobId: request.jobId,
      scheduleExecutionId: request.executionId,
      scheduleExecution: { scheduleId: request.parentId },
    };
  }
  if (request.kind === "httpTrigger") {
    return {
      jobId: request.jobId,
      httpTriggerExecutionId: request.executionId,
      httpTriggerExecution: { httpTriggerId: request.parentId },
    };
  }

  return {
    jobId: request.jobId,
    manualExecutionId: request.executionId,
    manualExecution: { pipelineId: request.parentId },
  };
};

export const fetchInvocationPayloadAction = async (
  input: InvocationPayloadRequest,
): Promise<InvocationPayload | null> => {
  await requireDashboardAdmin();
  const request = invocationPayloadRequestSchema.parse(input);
  const payloadQuery = {
    where: invocationPayloadWhere(request),
    select: {
      params: true,
      invocationConfig: true,
      error: true,
      agentResponse: true,
    },
  } satisfies Prisma.AgentJobExecutionFindFirstArgs;
  const job = await prisma.agentJobExecution.findFirst(payloadQuery);
  if (!job) {
    return null;
  }
  const maskedJob = maskInvocationPayloadForDisplay(job);

  return {
    inputMasked: maskedJob.params,
    configMasked: maskedJob.invocationConfig,
    transportError: maskedJob.error,
    agentResponse: maskedJob.agentResponse,
  };
};
