import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";
import { getPipelineWithSteps } from "@/lib/pipelines";
import { getPipelineStatus, validatePipeline } from "@/lib/validate-pipeline";
import { createTokenHint, hashHttpTriggerToken } from "@/lib/http-trigger-auth";

/** Parsed and validated HTTP trigger update form body (also used in tests). */
export const httpTriggerUpdateBodySchema = z.object({
  httpTriggerId: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  pipelineId: z.string().uuid().optional(),
  enabled: z
    .union([z.boolean(), z.literal("on"), z.literal("false")])
    .optional()
    .transform((v) =>
      v === true || v === "on" ? true : v === "false" ? false : undefined,
    ),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional(),
  /** Empty string from an optional password input means "keep current token". */
  bearerToken: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(1).optional(),
  ),
});

export const requestValidator = createRequestValidator({
  body: httpTriggerUpdateBodySchema,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdateHttpTriggerHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Updates an HTTP trigger and optionally rotates bearer token.
 */
export const createUpdateHttpTriggerHandler = ({
  db = prisma,
}: {
  db?: typeof prisma;
} = {}): UpdateHttpTriggerHandler => {
  return async (data) => {
    const existing = await db.httpTrigger.findUnique({
      where: { id: data.body.httpTriggerId },
    });
    if (!existing) return errorResponse("HTTP trigger not found");

    if (data.body.pipelineId != null) {
      const pipeline = await getPipelineWithSteps(data.body.pipelineId, db);
      if (!pipeline) return errorResponse("Pipeline not found");
      const validation = await validatePipeline(pipeline, db);
      if (getPipelineStatus(pipeline, validation) !== "enabled") {
        return errorResponse(
          "Pipeline must be enabled to assign to an HTTP trigger.",
        );
      }
    }

    await db.httpTrigger.update({
      where: { id: data.body.httpTriggerId },
      data: {
        ...(data.body.name !== undefined ? { name: data.body.name } : {}),
        ...(data.body.description !== undefined
          ? { description: data.body.description }
          : {}),
        ...(data.body.pipelineId !== undefined
          ? { pipelineId: data.body.pipelineId }
          : {}),
        ...(data.body.enabled !== undefined
          ? { enabled: data.body.enabled }
          : {}),
        ...(data.body.method !== undefined ? { method: data.body.method } : {}),
        ...(data.body.bearerToken !== undefined
          ? {
              tokenHash: hashHttpTriggerToken(data.body.bearerToken),
              tokenHint: createTokenHint(data.body.bearerToken),
            }
          : {}),
      },
    });
    return successResponse({ ok: true as const });
  };
};

export const handler: UpdateHttpTriggerHandler =
  createUpdateHttpTriggerHandler();
