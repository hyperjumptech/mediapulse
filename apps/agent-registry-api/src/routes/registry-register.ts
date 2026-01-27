import { validateBody } from "@workspace/api-utils";
import { prisma } from "@workspace/prisma";
import { Context } from "hono";
import { z } from "zod";
import { success } from "zod/v4";

const payloadSchema = z.object({
  agentId: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  endpoint: z.object({
    type: z.enum(['http', 'webhook', 'n8n', 'cloud-function']),
    url: z.string().url(),
    method: z.enum(['POST', 'PUT']),
    authentication: z.record(z.any()).optional(),
    timeout: z.number(),
    retryConfig: z.record(z.any()).optional(),
  }),
  inputSchema: z.record(z.any()),
  outputSchema: z.record(z.any()),
  parameterTypes: z.record(z.any()),
  enabled: z.boolean(),
  healthCheck: z.object({
    endpoint: z.string(),
    interval: z.number(),
  }).optional(),
  metadata: z.record(z.any()).optional(),
});


export const registryRegister = async (c: Context) => {

    ;

    try {

        const payload = await validateBody(c, payloadSchema);
        const agentRegistry = await prisma.agentRegistry.upsert({
            where: { agentId: payload.agentId },
            update: {
                name: payload.name,
                description: payload.description,
                version: payload.version,
                endpoint: payload.endpoint,
                inputSchema: payload.inputSchema,
                outputSchema: payload.outputSchema,
                parameterTypes: payload.parameterTypes,
                enabled: payload.enabled,
                healthCheck: payload.healthCheck,
                metadata: payload.metadata,
            },
            create: {
                agentId: payload.agentId,
                name: payload.name,
                description: payload.description,
                version: payload.version,
                endpoint: payload.endpoint,
                inputSchema: payload.inputSchema,
                outputSchema: payload.outputSchema,
                parameterTypes: payload.parameterTypes,
                enabled: payload.enabled,
                healthCheck: payload.healthCheck,
                metadata: payload.metadata,
            },
        })


        return c.json({
            success: true,
            agentId: agentRegistry.agentId,
            status: ,
            message: "Agent registry created/updated successfully",
        }, 200);

    } catch (error) {
                console.error(error);
        if (error instanceof Response) {
            return error;
        }

        return c.json({ message: "Internal server error" }, 500);

    }




}