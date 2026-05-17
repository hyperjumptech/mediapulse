import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { getPipelineWithSteps } from "@/lib/pipelines";
import { getPipelineStatus, validatePipeline } from "@/lib/validate-pipeline";
import { createTokenHint, hashHttpTriggerToken } from "@/lib/http-trigger-auth";

const bodyValidator = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  pipelineId: z.string().uuid(),
  enabled: z
    .union([z.boolean(), z.literal("on"), z.literal("false")])
    .optional()
    .transform((v) =>
      v === true || v === "on" ? true : v === "false" ? false : undefined,
    ),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  bearerToken: z.string().min(1, "Bearer token is required"),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
});

type CreateHttpTriggerHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates an HTTP trigger for an enabled pipeline.
 */
export const createCreateHttpTriggerHandler = ({
  db = prisma,
}: {
  db?: typeof prisma;
} = {}): CreateHttpTriggerHandler => {
  return async (data) => {
    const userId = data.user.id;
    const pipeline = await getPipelineWithSteps(data.body.pipelineId, db);
    if (!pipeline) return errorResponse("Pipeline not found");
    const validation = await validatePipeline(pipeline, db);
    if (getPipelineStatus(pipeline, validation) !== "enabled") {
      return errorResponse(
        "Pipeline must be enabled to create an HTTP trigger. Complete step input and config and ensure the pipeline is active.",
      );
    }

    const trigger = await db.httpTrigger.create({
      data: {
        name: data.body.name,
        description: data.body.description ?? null,
        pipelineId: data.body.pipelineId,
        enabled: data.body.enabled ?? true,
        method: data.body.method,
        authType: "BEARER_TOKEN",
        tokenHash: hashHttpTriggerToken(data.body.bearerToken),
        tokenHint: createTokenHint(data.body.bearerToken),
        createdById: userId,
      },
    });

    return successResponse({ id: trigger.id });
  };
};

export const handler: CreateHttpTriggerHandler =
  createCreateHttpTriggerHandler();
