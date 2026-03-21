import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { getDashboardSession } from "@/lib/auth-dashboard";
import { disableSchedulesForPipelineIfNotEnabled } from "@/lib/disable-schedules-for-pipeline";
import { validateDataSourceExpressions } from "@/lib/step-input-expansion";

const jsonObjectSchema = z
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
          throw new Error("must be valid JSON object");
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
  input: jsonObjectSchema,
  config: jsonObjectSchema,
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

    const { pipelineId, agentId, agentVersion, agentConfigId, input, config } =
      data.body;

    const inputObj = (input ?? {}) as Record<string, unknown>;
    const dataSourceValidation = validateDataSourceExpressions(inputObj);
    if (!dataSourceValidation.valid) {
      return errorResponse(
        `Input validation failed: ${dataSourceValidation.errors.join("; ")}`,
      );
    }

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

    // Do not validate input/config against agent schemas when adding a step.
    // User adds the agent to the pipeline first, then assigns input and config
    // in the third column. Validation happens on update-step (Save) or at run time.

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
        input: inputObj as object,
        config: agentConfigId != null ? {} : ((config ?? {}) as object),
      },
    });

    await disableSchedulesForPipelineIfNotEnabled(db, pipelineId);

    return successResponse({ stepId: step.id });
  };
};

/**
 * Handles add pipeline step: validates session and agent, appends step.
 */
export const handler: AddStepHandler = createAddStepHandler();
