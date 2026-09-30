import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";
import { domainEventNameSchema } from "@hermes/domain-contract";

import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { withDashboardRevalidation } from "@/lib/revalidate-dashboard";
import { getPipelineWithSteps } from "@/lib/pipelines";
import { getPipelineStatus, validatePipeline } from "@/lib/validate-pipeline";
import {
  createTokenHint,
  hashHttpTriggerToken,
} from "@hermes/domain-integration-crypto";

const bodyValidator = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  pipelineId: z.guid(),
  enabled: z
    .union([z.boolean(), z.literal("on"), z.literal("false")])
    .optional()
    .transform((v) =>
      v === true || v === "on"
        ? true
        : v === false || v === "false"
          ? false
          : undefined,
    ),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  startMode: z.enum(["token", "event"]).optional(),
  bearerToken: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  eventName: z.preprocess(
    (value) => (value === "" ? undefined : value),
    domainEventNameSchema.optional(),
  ),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  id: z.guid(),
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

    const { startMode, bearerToken, eventName } = data.body;
    const isEventTrigger = startMode === "event";
    if (isEventTrigger && eventName === undefined) {
      return errorResponse("Event name is required");
    }
    if (!isEventTrigger && bearerToken === undefined) {
      return errorResponse("Bearer token is required");
    }
    const startData = isEventTrigger
      ? {
          authType: "DOMAIN_EVENT" as const,
          eventName: eventName ?? null,
          method: "POST" as const,
          tokenHash: null,
          tokenHint: null,
        }
      : {
          authType: "BEARER_TOKEN" as const,
          eventName: null,
          method: data.body.method,
          tokenHash: hashHttpTriggerToken(bearerToken ?? ""),
          tokenHint: createTokenHint(bearerToken ?? ""),
        };

    const trigger = await db.httpTrigger.create({
      data: {
        name: data.body.name,
        description: data.body.description ?? null,
        pipelineId: data.body.pipelineId,
        enabled: data.body.enabled ?? true,
        ...startData,
        createdById: userId,
      },
    });

    return successResponse({ id: trigger.id });
  };
};

export const handler: CreateHttpTriggerHandler = withDashboardRevalidation(
  createCreateHttpTriggerHandler(),
);
