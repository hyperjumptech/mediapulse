import { Context } from "hono";
import { z } from "zod";

const BodySchema = z.object({
  userTickerId: z.string(),
});

export async function delivery(context: Context) {
  const logger = context.get("logger");
  try {
    const body = await context.req.json();
    await BodySchema.parseAsync(body);

    return context.json({ message: "Success" }, 200);
  } catch (error) {
    logger.error({ err: error }, "Delivery API error");
    return context.json({ message: "Internal Server Error" }, 500);
  }
}
