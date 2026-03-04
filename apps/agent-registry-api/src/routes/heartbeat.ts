import { validateBody } from "@workspace/api-utils";
import { prisma } from "@workspace/database";
import { Context } from "hono";
import { z } from "zod";

const BodySchema = z.object({
  instanceId: z.string(),
  status: z.enum(["active", "inactive", "unhealthy"]).optional(),
  currentLoad: z.number().int().nonnegative().optional(),
  capacity: z.number().int().nonnegative().optional(),
});

/**
 * Handles heartbeat from an agent instance.
 * @param context - Hono context
 * @returns JSON response with success and lastHeartbeat timestamp
 */
export async function heartbeat(context: Context) {
  const logger = context.get("logger");
  try {
    const body = await validateBody(context, BodySchema);

    const updatedInstance = await prisma.agentInstance.update({
      where: { instanceId: body.instanceId },
      data: {
        lastHeartbeat: new Date(),
        ...(body.status && { status: body.status }),
        ...(body.currentLoad !== undefined && {
          currentLoad: body.currentLoad,
        }),
        ...(body.capacity !== undefined && { capacity: body.capacity }),
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

    if (error?.code === "P2025") {
      return context.json(
        { success: false, message: "Instance not found" },
        404,
      );
    }

    logger.error({ err: error }, "Heartbeat error");
    return context.json(
      { success: false, message: "Internal server error" },
      500,
    );
  }
}
