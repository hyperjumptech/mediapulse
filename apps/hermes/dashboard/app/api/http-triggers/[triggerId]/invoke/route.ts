import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { prisma } from "@hermes/orchestration-database";

import {
  collectHttpTriggerRequestSnapshot,
  toHttpTriggerExecutionMetadata,
} from "@/lib/collect-http-trigger-request-snapshot";
import { verifyHttpTriggerToken } from "@hermes/domain-integration-crypto";
import { readHttpTriggerRunParams } from "@/lib/read-http-trigger-run-params";
import { startHttpTriggerExecution } from "@/lib/start-http-trigger-execution";

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
  const isTokenValid =
    token !== null &&
    trigger.tokenHash !== null &&
    verifyHttpTriggerToken(token, trigger.tokenHash);
  if (!isTokenValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runParamsResult = await readHttpTriggerRunParams(request);
  if (!runParamsResult.success) {
    return NextResponse.json(
      { error: `Invalid run params: ${runParamsResult.error}` },
      { status: 400 },
    );
  }

  const requestSnapshot = await collectHttpTriggerRequestSnapshot(request);
  const headerRequestId = request.headers.get("x-request-id")?.trim();
  const requestId =
    headerRequestId != null && headerRequestId !== ""
      ? headerRequestId
      : randomUUID();
  const executionId = await startHttpTriggerExecution({
    triggerId: trigger.id,
    executionConfig: trigger.pipeline.executionConfig,
    metadata: toHttpTriggerExecutionMetadata(requestSnapshot),
    requestId,
    runParams: runParamsResult.params,
  });

  return NextResponse.json(
    {
      status: "accepted",
      executionId,
    },
    { status: 202 },
  );
};
