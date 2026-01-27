import { validateBody } from "@workspace/api-utils";
import { prisma } from "@workspace/prisma";
import { Context } from "hono";
import { z } from "zod";

const PayloadSchema = z.object({
  instanceId: z.string(),
  status: z.enum(["active", "inactive", "unhealthy"]).optional(),
  currentLoad: z.number().optional(),
  capacity: z.number().optional(),
});

export const heartbeat = async (c: Context) => {
  try {
    const payload = await validateBody(c, PayloadSchema);

    const result = await prisma.agentInstance.update({
      where: {
        id: payload.instanceId,
      },
      data: {
        status: payload.status,
        currentLoad: payload.currentLoad,
        capacity: payload.capacity,
      },
    });

    return c.json(
      {
        success: true,
        lastHeartbeat: result.lastHeartbeat,
      },
      200,
    );

  } catch (error) {
    console.error(error);
    if (error instanceof Response) {
      return error;
    }

    return c.json({ message: "Internal server error" }, 500);
  }
}