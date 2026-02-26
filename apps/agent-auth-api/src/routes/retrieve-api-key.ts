import { prisma } from "@workspace/database";
import { Context } from "hono";

export async function retrieveAPIKey(context: Context) {
  const logger = context.get("logger");
  try {
    const id = context.req.param("id");

    const apiKey = await prisma.aPIKey.findUnique({
      where: { id },
      omit: { key: true, userId: true },
    });

    return context.json(
      { message: "API key retrieved successfully", data: apiKey },
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
