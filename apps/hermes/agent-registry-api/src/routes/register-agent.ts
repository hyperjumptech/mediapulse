import { validateBody } from "@workspace/api-utils";
import { Prisma, prisma } from "@hermes/orchestration-database";
import { Context } from "hono";
import { z } from "zod";

/** JSON Schema is an object (e.g. { type: "object", properties: { ... } }). */
const jsonSchemaObject = z
  .record(z.unknown())
  .refine((v) => v !== null && typeof v === "object" && !Array.isArray(v), {
    message: "Must be a JSON object",
  });

const BodySchema = z.object({
  agentId: z.string(),
  agentVersion: z.string(),
  description: z.string().optional(),
  endpoint: z.object({
    url: z.string().url(),
    method: z.enum(["POST"]),
  }),
  inputSchema: jsonSchemaObject,
  configSchema: jsonSchemaObject.optional(),
});

export async function registerAgent(context: Context) {
  const logger = context.get("logger");
  try {
    const body = await validateBody(context, BodySchema);

    const data = {
      agentId: body.agentId,
      agentVersion: body.agentVersion,
      description: body.description,
      endpoint: body.endpoint as Prisma.InputJsonValue,
      inputSchema: body.inputSchema as Prisma.InputJsonValue,
      configSchema: (body.configSchema as Prisma.InputJsonValue) ?? undefined,
    };

    const agentRegistry = await prisma.agentRegistry.upsert({
      where: {
        agentId_agentVersion: {
          agentId: body.agentId,
          agentVersion: body.agentVersion,
        },
      },
      create: data,
      update: {
        description: data.description,
        endpoint: data.endpoint,
        inputSchema: data.inputSchema,
        configSchema: data.configSchema,
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
