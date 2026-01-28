import { prisma } from "@workspace/prisma";

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
  try {
    const body = await context.req.json();
    const data = await BodySchema.parseAsync(body);
    await prisma.dataSource.createMany({ data });

    return context.json({ message: "Success" }, 200);
  } catch (error) {
    return context.json({ message: "Internal Server Error" }, 500);
  }
}
