import { prisma } from "@workspace/database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { getDashboardSession } from "@/lib/auth-dashboard";
import { validateWithJsonSchema } from "@/lib/validate-json-schema";

const configSchemaBody = z
  .union([
    z.record(z.unknown()),
    z
      .string()
      .optional()
      .transform((s): Record<string, unknown> => {
        if (s === undefined || s === null || s === "") return {};
        try {
          const v = JSON.parse(s) as unknown;
          if (typeof v === "object" && v !== null && !Array.isArray(v))
            return v as Record<string, unknown>;
          return {};
        } catch {
          throw new Error("config must be valid JSON object");
        }
      }),
  ])
  .optional()
  .default({});

const bodyValidator = z.object({
  pipelineId: z.string().uuid(),
  agentId: z.string().min(1),
  agentVersion: z.string().min(1),
  agentConfigId: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  config: configSchemaBody,
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
});

export const responseValidator = z.object({
  stepId: z.string().uuid(),
});

type AddStepHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type AddStepHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the add-step handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that adds a pipeline step (validates agent exists in registry).
 */
export const createAddStepHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: AddStepHandlerDependencies = {}): AddStepHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { pipelineId, agentId, agentVersion, agentConfigId, config } =
      data.body;

    const agent = await db.agentRegistry.findFirst({
      where: { agentId, agentVersion, isActive: true },
    });
    if (!agent) {
      return errorResponse(
        `Agent ${agentId}@${agentVersion} not found in registry`,
      );
    }

    if (agentConfigId != null) {
      const agentConfig = await db.agentConfig.findFirst({
        where: { id: agentConfigId, agentId, agentVersion },
      });
      if (!agentConfig) {
        return errorResponse(
          "Selected saved config not found or does not match this agent",
        );
      }
    }

    if (
      agentConfigId == null &&
      agent.configSchema != null &&
      typeof agent.configSchema === "object"
    ) {
      const result = validateWithJsonSchema(
        agent.configSchema as Record<string, unknown>,
        config,
      );
      if (!result.valid) {
        return errorResponse(
          `Config validation failed: ${result.errors.join("; ")}`,
        );
      }
    }

    const maxOrder = await db.pipelineStep.aggregate({
      where: { pipelineId },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const step = await db.pipelineStep.create({
      data: {
        pipelineId,
        agentId,
        agentVersion,
        order: nextOrder,
        agentConfigId: agentConfigId ?? null,
        config: agentConfigId != null ? {} : ((config ?? {}) as object),
      },
    });

    return successResponse({ stepId: step.id });
  };
};

/**
 * Handles add pipeline step: validates session and agent, appends step.
 */
export const handler: AddStepHandler = createAddStepHandler();
