import { prisma } from "@workspace/database";

import { Context } from "hono";
import { z } from "zod";

const BodySchema = z.object({
  subject: z.string(),
  description: z.string().optional(),
  content: z.string(),
  tickerId: z.string().uuid(),
});

export async function contentGeneration(context: Context) {
  const logger = context.get("logger");
  try {
    const body = await context.req.json();
    const data = await BodySchema.parseAsync(body);

    await prisma.newsletter.create({
      data: {
        subject: data.subject,
        description: data.description,
        content: data.content,
        tickerId: data.tickerId,
      },
    });

    return context.json({ message: "Success" }, 200);
  } catch (error) {
    logger.error({ err: error }, "Content generation API error");
    return context.json({ message: "Internal Server Error" }, 500);
  }
}
