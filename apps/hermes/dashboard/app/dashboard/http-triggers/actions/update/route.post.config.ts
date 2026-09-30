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

/** Parsed and validated HTTP trigger update form body (also used in tests). */
export const httpTriggerUpdateBodySchema = z.object({
  httpTriggerId: z.guid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  pipelineId: z.guid().optional(),
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
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional(),
  /** Empty string from an optional password input means "keep current token". */
  bearerToken: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(1).optional(),
  ),
  startMode: z.enum(["token", "event"]).optional(),
  eventName: z.preprocess(
    (val) => (val === "" ? undefined : val),
    domainEventNameSchema.optional(),
  ),
});

export const requestValidator = createRequestValidator({
  body: httpTriggerUpdateBodySchema,
  user: requireMutationDashboardPrincipalForRoute,
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

    const { startMode, eventName, bearerToken } = data.body;
    const nextEventName = eventName ?? existing.eventName ?? undefined;
    if (startMode === "event" && nextEventName === undefined) {
      return errorResponse("Event name is required");
    }
    const needsNewToken = startMode === "token" && existing.tokenHash === null;
    if (needsNewToken && bearerToken === undefined) {
      return errorResponse("Bearer token is required");
    }
    const startModeData =
      startMode === "event"
        ? {
            authType: "DOMAIN_EVENT" as const,
            eventName: nextEventName,
            tokenHash: null,
            tokenHint: null,
          }
        : startMode === "token"
          ? { authType: "BEARER_TOKEN" as const, eventName: null }
          : {};

    await db.httpTrigger.update({
      where: { id: data.body.httpTriggerId },
      data: {
        ...startModeData,
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
        ...(bearerToken !== undefined && startMode !== "event"
          ? {
              tokenHash: hashHttpTriggerToken(bearerToken),
              tokenHint: createTokenHint(bearerToken),
            }
          : {}),
      },
    });
    return successResponse({ ok: true as const });
  };
};

export const handler: UpdateHttpTriggerHandler = withDashboardRevalidation(
  createUpdateHttpTriggerHandler(),
);
