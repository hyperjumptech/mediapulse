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

type AgentInstanceStatus = "ACTIVE" | "INACTIVE" | "UNHEALTHY";
export const heartbeat = async (context: Context) => {
    try {
        const body = await validateBody(context, PayloadSchema);
        const status = body.status ? (body.status.toUpperCase() as AgentInstanceStatus) : undefined;

        const res = await prisma.agentInstance.update({
            where: {
                id: body.instanceId
            },
            data: {
                ...(status !== undefined ? { status } : {}),
                currentLoad: body.currentLoad,
                capacity: body.capacity,
            },
        });

        return context.json(
            {
                success: true,
                lastHeartbeat: res.lastHeartbeat,
            },
            200,
        );
    } catch (response) {
        if (response instanceof Response) {
            return response;
        }

        return context.json({ message: "Internal server error" }, 500);
    }
}   