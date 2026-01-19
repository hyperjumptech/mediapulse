import { prisma } from "@workspace/prisma";
import { Context } from "hono";

export async function deleteAPIKey(context: Context) {
  try {
    const id = context.req.param("id");

    await prisma.aPIKey.delete({
      where: { id },
    });

    return context.json({ message: "API key deleted successfully" }, 200);
  } catch (response) {
    if (response instanceof Response) {
      return response;
    }

    return context.json({ message: "Internal server error" }, 500);
  }
}
