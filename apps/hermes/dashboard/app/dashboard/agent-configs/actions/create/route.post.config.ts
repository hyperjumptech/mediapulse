import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";
import { configSchemaFingerprint } from "@/lib/config-schema-fingerprint";
import { validateAndSanitizeWithJsonSchema } from "@/lib/validate-json-schema";

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
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  agentId: z.string().min(1, "Agent ID is required"),
  agentVersion: z.string().min(1, "Agent version is required"),
  config: configBody,
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
});

type CreateAgentConfigHandlerDependencies = {
  db?: typeof prisma;
};

type CreateAgentConfigHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the create-agent-config handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that creates an agent config (validates against agent configSchema, stores fingerprint).
 */
export const createCreateAgentConfigHandler = ({
  db = prisma,
}: CreateAgentConfigHandlerDependencies = {}): CreateAgentConfigHandler => {
  return async (data) => {
    const userId = data.user.id;
    const { name, description, agentId, agentVersion, config } = data.body;
    let configToSave: Record<string, unknown> = config;

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
    if (configSchema) {
      const result = validateAndSanitizeWithJsonSchema(configSchema, config);
      if (!result.valid) {
        return errorResponse(
          `Config validation failed: ${result.errors.join("; ")}`,
        );
      }
      configToSave = result.data;
    }

    const fingerprint = configSchemaFingerprint(configSchema ?? undefined);

    const created = await db.agentConfig.create({
      data: {
        name,
        description: description ?? null,
        agentId,
        agentVersion,
        config: configToSave as object,
        configSchemaFingerprint: fingerprint || null,
        createdById: userId,
      },
    });

    return successResponse({ id: created.id });
  };
};

/**
 * Handles create agent config: validates session, agent, and config schema; stores fingerprint.
 */
export const handler: CreateAgentConfigHandler =
  createCreateAgentConfigHandler();
