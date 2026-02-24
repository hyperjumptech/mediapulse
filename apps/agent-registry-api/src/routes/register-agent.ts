import { validateBody } from "@workspace/api-utils";
import { Prisma, prisma } from "@workspace/database";
import { Context } from "hono";
import { z } from "zod";

const BodySchema = z.object({
  agentId: z.string(),
  agentVersion: z.string(),
  description: z.string().optional(),
  endpoint: z.object({
    url: z.string().url(),
    method: z.enum(["POST"]),
  }),
});

export async function registerAgent(context: Context) {
  const logger = context.get("logger");
  try {
    const body = await validateBody(context, BodySchema);

    const agentRegistry = await prisma.agentRegistry.create({
      data: {
        agentId: body.agentId,
        agentVersion: body.agentVersion,
        description: body.description,
        endpoint: body.endpoint as Prisma.InputJsonValue,
      },
    });

    return context.json(
      { message: "Agent registered successfully", data: agentRegistry },
      200,
    );
  } catch (response) {
    if (response instanceof Response) {
      return response;
    }
    logger.error({ err: response }, "Register agent error");
    return context.json({ message: "Internal server error" }, 500);
  }
}
