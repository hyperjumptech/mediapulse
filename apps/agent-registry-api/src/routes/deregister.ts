import { validateBody } from "@workspace/api-utils";
import { prisma } from "@workspace/prisma";
import { Context } from "hono";
import { z } from "zod";


const PayloadSchema = z.object({
    instanceId: z.string(),
});

export const deRegister = async (c: Context) => {
    try {
        const payload = await validateBody(c, PayloadSchema);

        const result = await prisma.agentInstance.delete({
            where: {
                id: payload.instanceId,
            },
        });

        return c.json(
            {
                success: true,
                message: "Agent instance deregistered successfully",
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
