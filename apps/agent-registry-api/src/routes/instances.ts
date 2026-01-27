import { validateBody } from "@workspace/api-utils";
import { prisma } from "@workspace/prisma";
import { Context } from "hono";
import { z } from "zod";

export const instances = async (c: Context) => {
    try {

        const agentId = c.req.param("agentId");
        const agentVersion = c.req.param("agentVersion");
        const status = c.req.param("status");
        const minCapacity = c.req.param("minCapacity");

        const instances = await prisma.agentInstance.findMany({
            where: {
                ...(agentId && { agentId }),
                ...(agentVersion && { agentVersion }),
                ...(minCapacity && { capacity: { gte: parseInt(minCapacity) } }),
                status: status || 'ACTIVE',
            },
        });
        return c.json(instances, 200);
    } catch (error) {
        console.error(error);
        if (error instanceof Response) {
            return error;
        }

        return c.json({ message: "Internal server error" }, 500);
    }
}