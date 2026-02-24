import { prisma } from "@workspace/database";
import { Context } from "hono";

export async function reactivateAPIKey(context: Context) {
  const logger = context.get("logger");
  try {
    const id = context.req.param("id");

    await prisma.aPIKey.update({
      where: { id },
      data: { isActive: true },
    });

    return context.json({ message: "API key reactivated successfully" }, 200);
  } catch (response) {
    if (response instanceof Response) {
      return response;
    }
    logger.error({ err: response }, "Auth API error");
    return context.json({ message: "Internal server error" }, 500);
  }
}
