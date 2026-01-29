import { validateBody } from "@workspace/api-utils";
import { prisma } from "@workspace/prisma";
import { Context } from "hono";
import { z } from "zod";
import { success } from "zod/v4";

const payloadSchema = z.object({
    agentId: z.string(),
    // Accept either `agentVersion` or `version` from clients and map to `agentVersion`
    agentVersion: z.string().optional(),
    version: z.string().optional(),
    description: z.string().optional(),
    endpoint: z.object({
        type: z.enum(['http', 'webhook', 'n8n', 'cloud-function']),
        url: z.string().url(),
        method: z.enum(['POST', 'PUT']),
        authentication: z.record(z.any()).optional(),
        timeout: z.number(),
        retryConfig: z.record(z.any()).optional(),
    }),
    // The Prisma model currently doesn't include these richer fields; accept but ignore/store as metadata if needed
    // Allow arbitrary metadata to be passed through and stored if desired
    metadata: z.record(z.any()).optional(),
    // allow enabled -> map to `isActive` on the model
    enabled: z.boolean().optional(),
});


export const registryRegister = async (c: Context) => {


    try {

        const payload = await validateBody(c, payloadSchema);

        const agentExists = await prisma.agentRegistry.findUnique({
            where: { agentId: payload.agentId },
        });

        let agentRegistry;
        // Normalize fields to match the Prisma `AgentRegistry` model
        const agentVersion = payload.agentVersion ?? payload.version;
        const data: any = {
            agentId: payload.agentId,
            agentVersion,
            description: payload.description,
            endpoint: payload.endpoint,
            isActive: payload.enabled ?? true,
        };

        // Optionally store arbitrary metadata in the `metadata` JSON column if provided
        if (payload.metadata) data.metadata = payload.metadata;

        if (agentExists) {
            agentRegistry = await prisma.agentRegistry.update({
                where: { id: agentExists.id },
                data,
            });
        } else {
            agentRegistry = await prisma.agentRegistry.create({
                data,
            });
        }

        return c.json({
            success: true,
            agentId: payload.agentId,
            status: agentExists ? "updated" : "created",
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