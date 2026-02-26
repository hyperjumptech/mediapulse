import { prisma } from "@workspace/prisma";
import { Context } from "hono";

export const registry = async (context: Context) => {
  try {
    const agentId = context.req.query("agentId");
    const isEnabled = context.req.query("enabled");

    const instances = await prisma.agentInstance.findMany({
      where: {
        ...(agentId && { agentId }),
        status: isEnabled === "true" ? "ACTIVE" : undefined,
      },
    });
    return context.json({ instances, total: instances.length }, 200);
  } catch (error) {
    console.error(error);
    if (error instanceof Response) {
      return error;
    }

    return context.json({ message: "Internal server error" }, 500);
  }
};
