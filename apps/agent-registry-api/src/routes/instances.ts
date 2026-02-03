import { validateBody } from "@workspace/api-utils";
import { prisma } from "@workspace/prisma";
import { Context } from "hono";
import { z } from "zod";

const AgentInstanceStatusEnum = z.enum(["ACTIVE", "INACTIVE", "UNHEALTHY"]);
type AgentInstanceStatus = z.infer<typeof AgentInstanceStatusEnum>;
export const instances = async (c: Context) => {
  try {
    const agentId = c.req.param("agentId");
    const agentVersion = c.req.param("agentVersion");
    const statusParam = c.req.param("status");
    const minCapacity = c.req.param("minCapacity");

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

    const instances = await prisma.agentInstance.findMany({
      where: {
        ...(agentId && { agentId }),
        ...(agentVersion && { agentVersion }),
        ...(minCapacity && { capacity: { gte: parseInt(minCapacity) } }),
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
