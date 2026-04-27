import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";
import { zFormBoolean } from "@/lib/form-boolean-schema";

const bodyValidator = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isActive: zFormBoolean.optional().default(true),
  domainIntegrationId: z.string().uuid().optional(),
  timeout: z
    .union([z.literal(""), z.coerce.number()])
    .optional()
    .nullable()
    .transform((v): number | null => {
      if (v === "" || v === undefined || v === null) return null;
      const n = Number(v);
      return n > 0 ? n : null;
    }),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
});

type CreatePipelineHandlerDependencies = {
  db?: typeof prisma;
};

type CreatePipelineHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the create-pipeline handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that creates a pipeline and returns its id.
 */
export const createCreatePipelineHandler = ({
  db = prisma,
}: CreatePipelineHandlerDependencies = {}): CreatePipelineHandler => {
  return async (data) => {
    const userId = data.user.id;
    const {
      name,
      description,
      isActive,
      domainIntegrationId: bodyDomainId,
      timeout,
    } = data.body;

    let domainIntegrationId = bodyDomainId;
    if (!domainIntegrationId) {
      const first = await db.domainIntegration.findFirst({
        orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
        select: { id: true },
      });
      if (!first) {
        return errorResponse(
          "No domain integration configured; add one under Domain integrations before creating pipelines.",
        );
      }
      domainIntegrationId = first.id;
    }

    const pipeline = await db.pipeline.create({
      data: {
        name,
        description: description ?? null,
        isActive: isActive ?? true,
        domainIntegrationId,
        createdById: userId,
        timeout: timeout ?? null,
      },
    });

    return successResponse({ id: pipeline.id });
  };
};

/**
 * Handles create pipeline: validates session and creates pipeline in DB.
 */
export const handler: CreatePipelineHandler = createCreatePipelineHandler();
