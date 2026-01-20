import { Context } from "hono";
import { z } from "zod";

export async function validateBody<T extends z.ZodType>(
  context: Context,
  schema: T,
): Promise<z.infer<T>> {
  const body = await context.req.json();
  const result = await schema.safeParseAsync(body);

  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join(".");
    const errorMessage = `${field}: ${issue?.message}`;

    throw context.json({ message: errorMessage }, 400);
  }

  return result.data;
}
