import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { configSchemaFingerprint } from "@/lib/config-schema-fingerprint";
import { stripConfigToJsonSchema } from "@/lib/strip-config-to-json-schema";
import { validateWithJsonSchema } from "@/lib/validate-json-schema";

const configBody = z
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
  .default({});

const bodyValidator = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  agentId: z.string().min(1),
  agentVersion: z.string().min(1),
  config: configBody,
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdateAgentConfigHandlerDependencies = {
  db?: typeof prisma;
};

type UpdateAgentConfigHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the update-agent-config handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that updates an agent config and refreshes fingerprint.
 */
export const createUpdateAgentConfigHandler = ({
  db = prisma,
}: UpdateAgentConfigHandlerDependencies = {}): UpdateAgentConfigHandler => {
  return async (data) => {
    const { id, name, description, agentId, agentVersion, config } = data.body;

    const existing = await db.agentConfig.findUnique({
      where: { id },
    });
    if (!existing) {
      return errorResponse("Agent config not found");
    }

    const agent = await db.agentRegistry.findFirst({
      where: { agentId, agentVersion, isActive: true },
    });
    if (!agent) {
      return errorResponse(
        `Agent ${agentId}@${agentVersion} not found in registry`,
      );
    }

    const configSchema =
      agent.configSchema != null && typeof agent.configSchema === "object"
        ? (agent.configSchema as Record<string, unknown>)
        : null;
    const configToStore =
      configSchema != null
        ? stripConfigToJsonSchema(configSchema, config)
        : config;
    if (configSchema) {
      const result = validateWithJsonSchema(configSchema, configToStore);
      if (!result.valid) {
        return errorResponse(
          `Config validation failed: ${result.errors.join("; ")}`,
        );
      }
    }

    const fingerprint = configSchemaFingerprint(configSchema ?? undefined);

    await db.agentConfig.update({
      where: { id },
      data: {
        name,
        description: description ?? null,
        agentId,
        agentVersion,
        config: configToStore as object,
        configSchemaFingerprint: fingerprint || null,
      },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles update agent config: validates session, config schema; updates fingerprint.
 */
export const handler: UpdateAgentConfigHandler =
  createUpdateAgentConfigHandler();
