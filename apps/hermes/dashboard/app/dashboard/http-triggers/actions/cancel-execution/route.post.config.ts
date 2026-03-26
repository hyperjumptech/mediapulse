import {
  createRequestValidator,
  errorResponse,
  successResponse,
} from "route-action-gen/lib";
import type { HandlerFunc } from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";
import {
  cancelExecution as defaultCancelExecution,
  type CancelExecutionResult,
} from "@/lib/cancel-execution";

const bodyValidator = z.object({
  executionId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
  runStatus: z.string(),
});

type CancelExecutionHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

type CancelExecutionHandlerDeps = {
  cancelExecution?: (
    source: "http-trigger",
    executionId: string,
  ) => Promise<CancelExecutionResult>;
};

/**
 * Creates the HTTP trigger execution cancellation handler with dependency injection.
 *
 * @param deps - Optional cancellation collaborator for tests.
 * @returns Handler that cancels an HTTP trigger execution idempotently.
 */
export const createCancelHttpTriggerExecutionHandler = ({
  cancelExecution = (source, executionId) =>
    defaultCancelExecution(source, executionId),
}: CancelExecutionHandlerDeps = {}): CancelExecutionHandler => {
  return async ({ body }) => {
    const result = await cancelExecution("http-trigger", body.executionId);
    if (result.kind === "not_found") {
      return errorResponse("Execution not found");
    }
    return successResponse({
      ok: true as const,
      runStatus: result.runStatus,
    });
  };
};

/**
 * Handles HTTP trigger execution cancellation requests.
 */
export const handler: CancelExecutionHandler =
  createCancelHttpTriggerExecutionHandler();
