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

const BodySchema = z.object({
  domainIntegrationId: z.string().min(1),
  agentId: z.string(),
  agentVersion: z.string(),
});

/**
 * Unregisters (deletes) an agent registry entry for a domain integration.
 *
 * Unlike registration, this is an operator/admin action: the internal Hermes preset token is
 * accepted, and a domain-integration JWT is accepted when its `sub` matches the integration that
 * owns the entry. The call is idempotent — deleting a missing entry still returns 200.
 */
export async function unregisterAgent(context: Context) {
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

    const isInternal = sub === HERMES_INTERNAL_TOKEN_SUBJECT;

    if (!isInternal) {
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
    }

    try {
      await prisma.agentRegistry.delete({
        where: {
          domainIntegrationId_agentId_agentVersion: {
            domainIntegrationId: body.domainIntegrationId,
            agentId: body.agentId,
            agentVersion: body.agentVersion,
          },
        },
      });
    } catch (error) {
      // P2025 = record to delete does not exist; treat unregister as idempotent.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return context.json(
          { message: "Agent registration not found (already unregistered)" },
          200,
        );
      }
      throw error;
    }

    return context.json({ message: "Agent unregistered successfully" }, 200);
  } catch (response) {
    if (response instanceof Response) {
      return response;
    }
    logger.error({ err: response }, "Unregister agent error");
    return context.json({ message: "Internal server error" }, 500);
  }
}
