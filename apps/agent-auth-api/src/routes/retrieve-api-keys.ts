import { prisma } from "@workspace/database";
import { Context } from "hono";

export async function retrieveAPIKeys(context: Context) {
  const logger = context.get("logger");
  try {
    const apiKey = await prisma.aPIKey.findMany({
      omit: { key: true, userId: true },
    });

    return context.json(
      { message: "API keys retrieved successfully", data: apiKey },
      200,
    );
  } catch (response) {
    if (response instanceof Response) {
      return response;
    }
    logger.error({ err: response }, "Auth API error");
    return context.json({ message: "Internal server error" }, 500);
  }
}
