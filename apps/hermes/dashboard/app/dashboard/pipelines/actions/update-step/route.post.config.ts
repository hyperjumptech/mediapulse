import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { collectEmptyRequiredStringErrors } from "@/lib/validate-required-fields";
import { validateDataSourceExpressions } from "@/lib/step-input-expansion";
import { validateWithJsonSchema } from "@/lib/validate-json-schema";

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
  stepId: z.string().uuid(),
  agentId: z.string().min(1),
  agentVersion: z.string().min(1),
  agentConfigId: z
    .union([z.string().uuid(), z.literal("")])
    .nullable()
    .optional()
    .transform((s) => (s === "" ? null : (s ?? null))),
  agentContractId: z
    .union([z.string().uuid(), z.literal("")])
    .nullable()
    .optional()
    .transform((s) => (s === "" ? null : (s ?? null))),
  input: jsonObjectSchema,
  config: jsonObjectSchema,
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
  validationWarnings: z.array(z.string()).optional(),
});

type UpdateStepHandlerDependencies = {
  db?: typeof prisma;
};

type UpdateStepHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the update-step handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that updates a pipeline step (agentId/agentVersion) and persists to DB.
 */
export const createUpdateStepHandler = ({
  db = prisma,
}: UpdateStepHandlerDependencies = {}): UpdateStepHandler => {
  return async (data) => {
    const {
      pipelineId,
      stepId,
      agentId,
      agentVersion,
      agentConfigId,
      agentContractId,
      input,
      config,
    } = data.body;

    const inputObj = (input ?? {}) as Record<string, unknown>;
    const dataSourceValidation = validateDataSourceExpressions(inputObj);
    if (!dataSourceValidation.valid) {
      return errorResponse(
        `Input validation failed: ${dataSourceValidation.errors.join("; ")}`,
      );
    }

    const step = await db.pipelineStep.findFirst({
      where: { id: stepId, pipelineId },
    });
    if (!step) {
      return errorResponse("Step not found");
    }

    const agent = await db.agentRegistry.findFirst({
      where: { agentId, agentVersion, isActive: true },
    });
    if (!agent) {
      return errorResponse(
        `Agent ${agentId}@${agentVersion} not found in registry`,
      );
    }

    let savedAgentConfig: { config: unknown } | null = null;
    if (agentConfigId != null) {
      const found = await db.agentConfig.findFirst({
        where: { id: agentConfigId, agentId, agentVersion },
      });
      if (!found) {
        return errorResponse(
          "Selected saved config not found or does not match this agent",
        );
      }
      savedAgentConfig = found;
    }

    const validationWarnings: string[] = [];
    if (agent.inputSchema != null && typeof agent.inputSchema === "object") {
      const emptyRequiredErrors = collectEmptyRequiredStringErrors(
        agent.inputSchema as { type?: string | string[]; required?: string[] },
        inputObj,
      );
      if (emptyRequiredErrors.length > 0) {
        validationWarnings.push(`Input: ${emptyRequiredErrors.join("; ")}`);
      }
      const result = validateWithJsonSchema(
        agent.inputSchema as Record<string, unknown>,
        inputObj,
      );
      if (!result.valid) {
        validationWarnings.push(`Input: ${result.errors.join("; ")}`);
      }
    }
    if (agent.configSchema != null && typeof agent.configSchema === "object") {
      const effectiveConfig =
        savedAgentConfig != null
          ? savedAgentConfig.config != null &&
            typeof savedAgentConfig.config === "object" &&
            !Array.isArray(savedAgentConfig.config)
            ? (savedAgentConfig.config as Record<string, unknown>)
            : {}
          : ((config ?? {}) as Record<string, unknown>);
      const emptyRequiredErrors = collectEmptyRequiredStringErrors(
        agent.configSchema as { type?: string | string[]; required?: string[] },
        effectiveConfig,
      );
      if (emptyRequiredErrors.length > 0) {
        validationWarnings.push(`Config: ${emptyRequiredErrors.join("; ")}`);
      }
      const result = validateWithJsonSchema(
        agent.configSchema as Record<string, unknown>,
        effectiveConfig,
      );
      if (!result.valid) {
        validationWarnings.push(`Config: ${result.errors.join("; ")}`);
      }
    }

    await db.pipelineStep.update({
      where: { id: stepId },
      data: {
        agentId,
        agentVersion,
        agentConfigId: agentConfigId ?? null,
        agentContractId: agentContractId ?? null,
        input: inputObj as object,
        config:
          agentConfigId != null && agentConfigId !== ""
            ? {}
            : ((config ?? {}) as object),
      },
    });

    return successResponse({
      ok: true as const,
      ...(validationWarnings.length > 0 && { validationWarnings }),
    });
  };
};

/**
 * Handles update pipeline step: validates session, step, and agent; persists changes to DB.
 */
export const handler: UpdateStepHandler = createUpdateStepHandler();
