import { validateBody } from "@workspace/api-utils";
import {
  DomainIntegrationStatus,
  Prisma,
  prisma,
} from "@hermes/orchestration-database";
import { decodeJwt } from "jose";
import { Context } from "hono";
import { z } from "zod";

/** Must match {@link HERMES_INTERNAL_TOKEN_SUBJECT} in agent-auth-api issue-token (internal preset JWT `sub`). */
const HERMES_INTERNAL_TOKEN_SUBJECT = "00000000-0000-4000-8000-000000000001";

/** JSON Schema is an object (e.g. { type: "object", properties: { ... } }). */
const jsonSchemaObject = z
  .record(z.unknown())
  .refine((v) => v !== null && typeof v === "object" && !Array.isArray(v), {
    message: "Must be a JSON object",
  });

const BodySchema = z.object({
  domainIntegrationId: z.string().min(1),
  agentId: z.string(),
  agentVersion: z.string(),
  description: z.string().optional(),
  endpoint: z.object({
    url: z.string().url(),
    method: z.enum(["POST"]),
  }),
  inputSchema: jsonSchemaObject,
  configSchema: jsonSchemaObject.optional(),
});

/**
 * Registers or updates an agent for a specific domain integration.
 * JWT `sub` must be the orchestration `domain_integration.id`; internal preset tokens are rejected.
 */
export async function registerAgent(context: Context) {
  const logger = context.get("logger");
  try {
    const body = await validateBody(context, BodySchema);

    const authHeader = context.req.header("Authorization");
    const rawJwt = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!rawJwt) {
      return context.json({ message: "Unauthorized" }, 401);
    }

    let sub: string;
    try {
      const claims = decodeJwt(rawJwt);
      sub =
        typeof claims.sub === "string" ? claims.sub : String(claims.sub ?? "");
    } catch {
      return context.json({ message: "Invalid token" }, 401);
    }

    if (sub === HERMES_INTERNAL_TOKEN_SUBJECT) {
      return context.json(
        {
          message:
            "Registry registration must use a domain integration API key (not HERMES_INTERNAL_API_KEY)",
        },
        403,
      );
    }

    const integration = await prisma.domainIntegration.findFirst({
      where: {
        integrationId: body.domainIntegrationId,
        status: DomainIntegrationStatus.active,
        id: sub,
      },
    });

    if (!integration) {
      return context.json(
        {
          message:
            "No active domain integration matches this credential and integration id",
        },
        403,
      );
    }

    const data = {
      agentId: body.agentId,
      agentVersion: body.agentVersion,
      description: body.description,
      endpoint: body.endpoint as Prisma.InputJsonValue,
      inputSchema: body.inputSchema as Prisma.InputJsonValue,
      configSchema: (body.configSchema as Prisma.InputJsonValue) ?? undefined,
      domainIntegrationId: integration.id,
    };

    const agentRegistry = await prisma.agentRegistry.upsert({
      where: {
        domainIntegrationId_agentId_agentVersion: {
          domainIntegrationId: integration.id,
          agentId: body.agentId,
          agentVersion: body.agentVersion,
        },
      },
      create: data,
      update: {
        description: data.description,
        endpoint: data.endpoint,
        inputSchema: data.inputSchema,
        configSchema: data.configSchema,
      },
    });

    return context.json(
      { message: "Agent registered successfully", data: agentRegistry },
      200,
    );
  } catch (response) {
    if (response instanceof Response) {
      return response;
    }
    logger.error({ err: response }, "Register agent error");
    return context.json({ message: "Internal server error" }, 500);
  }
}
