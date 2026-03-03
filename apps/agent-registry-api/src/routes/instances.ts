import { prisma } from "@workspace/prisma";
import { Context } from "hono";
import { z } from "zod";

const AgentInstanceStatusEnum = z.enum(["ACTIVE", "INACTIVE", "UNHEALTHY"]);
type AgentInstanceStatus = z.infer<typeof AgentInstanceStatusEnum>;
export const instances = async (c: Context) => {
  try {
    const agentId = c.req.query("agentId");
    const agentVersion = c.req.query("agentVersion");
    const statusParam = c.req.query("status");
    const minCapacity = c.req.query("minCapacity");

    // validate status and default to ACTIVE
    const statusSchema = AgentInstanceStatusEnum;
    let statusFilter: AgentInstanceStatus = "ACTIVE";
    if (statusParam) {
      const parsed = statusSchema.safeParse(statusParam);
      if (!parsed.success) {
        return c.json({ message: "Invalid status" }, 400);
      }
      statusFilter = parsed.data;
    }

    let parsedMinCapacity: number | undefined;
    if (minCapacity) {
      parsedMinCapacity = parseInt(minCapacity, 10);
      if (isNaN(parsedMinCapacity)) {
        return c.json({ message: "Invalid minCapacity" }, 400);
      }
    }

    const instances = await prisma.agentInstance.findMany({
      where: {
        ...(agentId && { agentId }),
        ...(agentVersion && { agentVersion }),
        ...(parsedMinCapacity !== undefined && {
          capacity: { gte: parsedMinCapacity },
        }),
        status: statusFilter,
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
};
