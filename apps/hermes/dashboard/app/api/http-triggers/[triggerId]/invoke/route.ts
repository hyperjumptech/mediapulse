import { NextResponse } from "next/server";
import { prisma, ScheduleEnqueueStatus } from "@hermes/orchestration-database";

import { getHermesJobQueue } from "@/lib/hermes-job-queue";
import { verifyHttpTriggerToken } from "@/lib/http-trigger-auth";

const parseBearerToken = (authorization: string | null): string | null => {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ", 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
};

/**
 * Invokes an HTTP trigger by creating an execution row and enqueueing worker job.
 */
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ triggerId: string }> },
) => handleInvoke(request, params);
export const POST = async (
  request: Request,
  { params }: { params: Promise<{ triggerId: string }> },
) => handleInvoke(request, params);
export const PUT = async (
  request: Request,
  { params }: { params: Promise<{ triggerId: string }> },
) => handleInvoke(request, params);
export const DELETE = async (
  request: Request,
  { params }: { params: Promise<{ triggerId: string }> },
) => handleInvoke(request, params);
export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ triggerId: string }> },
) => handleInvoke(request, params);

const handleInvoke = async (
  request: Request,
  paramsPromise: Promise<{ triggerId: string }>,
): Promise<Response> => {
  const { triggerId } = await paramsPromise;
  const trigger = await prisma.httpTrigger.findUnique({
    where: { id: triggerId },
    select: {
      id: true,
      method: true,
      enabled: true,
      tokenHash: true,
      pipeline: { select: { executionConfig: true } },
    },
  });
  if (!trigger) {
    return NextResponse.json(
      { error: "HTTP trigger not found" },
      { status: 404 },
    );
  }
  if (!trigger.enabled) {
    return NextResponse.json(
      { error: "HTTP trigger is disabled" },
      { status: 409 },
    );
  }
  if (trigger.method !== request.method) {
    return NextResponse.json(
      { error: `Method not allowed. Expected ${trigger.method}` },
      { status: 405 },
    );
  }

  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token || !verifyHttpTriggerToken(token, trigger.tokenHash)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const execution = await prisma.httpTriggerExecution.create({
    data: {
      httpTriggerId: trigger.id,
      executionTime: new Date(),
      enqueueStatus: ScheduleEnqueueStatus.success,
      jobsCreated: 0,
      jobsEnqueued: 0,
      effectiveExecutionConfig:
        trigger.pipeline.executionConfig != null
          ? trigger.pipeline.executionConfig
          : undefined,
      metadata: {
        requestedMethod: request.method,
      },
    },
    select: { id: true },
  });
  await prisma.httpTrigger.update({
    where: { id: trigger.id },
    data: { lastTriggeredAt: new Date() },
  });

  await getHermesJobQueue().addJob({
    jobType: "execute_http_trigger",
    payload: {
      httpTriggerExecutionId: execution.id,
    },
    idempotencyKey: `execute_http_trigger:${execution.id}`,
    tags: [`httpTriggerExecution:${execution.id}`],
  });

  return NextResponse.json(
    {
      status: "accepted",
      executionId: execution.id,
    },
    { status: 202 },
  );
};
