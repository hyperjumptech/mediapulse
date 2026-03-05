import { validateBody } from "@workspace/api-utils";
import { prisma, AgentStatus } from "@workspace/database";
import { Context } from "hono";
import { z } from "zod";

const BodySchema = z.object({
  instanceId: z.string(),
  agentId: z.string(),
  agentVersion: z.string(),
  status: z.nativeEnum(AgentStatus).optional(),
  currentLoad: z.number().int().nonnegative().optional(),
  capacity: z.number().int().nonnegative().optional(),
});

/**
 * Handles heartbeat from an agent instance.
 * Performs implicit registration (upsert) of the agent instance if it doesn't exist,
 * by fetching the required endpoint from the AgentRegistry.
 * @param context - Hono context
 * @returns JSON response with success and lastHeartbeat timestamp
 */
export async function heartbeat(context: Context) {
  const logger = context.get("logger");
  try {
    const body = await validateBody(context, BodySchema);

    // Find the agent registry to get the endpoint if we need to create the instance
    const registry = await prisma.agentRegistry.findUnique({
      where: {
        agentId_agentVersion: {
          agentId: body.agentId,
          agentVersion: body.agentVersion,
        },
      },
    });

    if (!registry) {
      return context.json(
        { success: false, message: "Agent registry not found" },
        404,
      );
    }

    const updatedInstance = await prisma.agentInstance.upsert({
      where: { instanceId: body.instanceId },
      update: {
        lastHeartbeat: new Date(),
        ...(body.status && { status: body.status }),
        ...(body.currentLoad !== undefined && {
          currentLoad: body.currentLoad,
        }),
        ...(body.capacity !== undefined && { capacity: body.capacity }),
      },
      create: {
        instanceId: body.instanceId,
        agentId: body.agentId,
        agentVersion: body.agentVersion,
        endpoint: registry.endpoint as any,
        status: body.status ?? "active",
        currentLoad: body.currentLoad ?? 0,
        capacity: body.capacity ?? 10,
        lastHeartbeat: new Date(),
      },
    });

    return context.json(
      { success: true, lastHeartbeat: updatedInstance.lastHeartbeat },
      200,
    );
  } catch (error: any) {
    if (error instanceof Response) {
      return error;
    }

    logger.error({ err: error }, "Heartbeat error");
    return context.json(
      { success: false, message: "Internal server error" },
      500,
    );
  }
}
