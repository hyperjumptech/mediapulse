import { Context } from "hono";
import { z } from "zod";

const BodySchema = z.object({
  userTickerId: z.string(),
});

export async function delivery(context: Context) {
  try {
    const body = await context.req.json();
    await BodySchema.parseAsync(body);

    return context.json({ message: "Success" }, 200);
  } catch (error) {
    return context.json({ message: "Internal Server Error" }, 500);
  }
}
