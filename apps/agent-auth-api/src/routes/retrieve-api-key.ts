import { prisma } from "@workspace/prisma";
import { Context } from "hono";

export async function retrieveAPIKey(context: Context) {
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

    return context.json({ message: "Internal server error" }, 500);
  }
}
