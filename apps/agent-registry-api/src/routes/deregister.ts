import { validateBody } from "@workspace/api-utils";
import { prisma } from "@workspace/prisma";
import { Context } from "hono";
import { z } from "zod";



const PayloadSchema = z.object({
    instanceId: z.string(),
});

export const deregister = async (c: any) => {

    try {
        const body = await validateBody(c, PayloadSchema);

        await prisma.agentInstance.delete({
            where: {
                id: body.instanceId
            },
        });

        return c.json(
            {
                success: true,
                message: "agent " + body.instanceId + " deregistered"
            },
            200,
        );
    } catch (response) {
        if (response instanceof Response) {
            return response;
        }

        return c.json({ message: "Internal server error" }, 500);
    }

}