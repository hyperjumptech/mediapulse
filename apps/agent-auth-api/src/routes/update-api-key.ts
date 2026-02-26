import { validateBody } from "@workspace/api-utils";
import { prisma } from "@workspace/database";
import { Context } from "hono";
import { z } from "zod";

const BodySchema = z.object({
  name: z.string(),
});

export async function updateAPIKey(context: Context) {
  const logger = context.get("logger");
  try {
    const id = context.req.param("id");
    const body = await validateBody(context, BodySchema);

    await prisma.aPIKey.update({
      where: { id },
      data: { name: body.name },
    });

    return context.json({ message: "API key updated successfully" }, 201);
  } catch (response) {
    if (response instanceof Response) {
      return response;
    }
    logger.error({ err: response }, "Auth API error");
    return context.json({ message: "Internal server error" }, 500);
  }
}
