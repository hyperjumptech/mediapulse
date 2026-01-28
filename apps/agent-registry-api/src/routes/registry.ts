import { prisma } from "@workspace/prisma";
import { Context } from "hono";



export const registry = async (c: Context) => {
    try {

        const agentId = c.req.param("agentId");
        const isEnabled = c.req.param("enabled");

        const instances = await prisma.agentInstance.findMany({
            where: {
                ...(agentId && { agentId }),
                status: isEnabled === 'true' ? 'ACTIVE' : undefined,
            },
        });


        return c.json(
           { instances, total: instances.length },
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