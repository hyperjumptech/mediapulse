import { prisma } from "@workspace/database";

import { Context } from "hono";
import { z } from "zod";

const BodySchema = z.array(
  z.object({
    url: z.string().url(),
    title: z.string(),
    content: z.string(),
    tickerId: z.string().uuid(),
    searchQueryId: z.string().uuid(),
  }),
);

export async function dataCollection(context: Context) {
  const logger = context.get("logger");
  try {
    const body = await context.req.json();
    const data = await BodySchema.parseAsync(body);
    await prisma.dataSource.createMany({ data });

    return context.json({ message: "Success" }, 200);
  } catch (error) {
    logger.error({ err: error }, "Data collection API error");
    return context.json({ message: "Internal Server Error" }, 500);
  }
}
