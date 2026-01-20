import { prisma } from "@workspace/prisma";
import { Context } from "hono";

export async function deactivateAPIKey(context: Context) {
  try {
    const id = context.req.param("id");

    await prisma.aPIKey.update({
      where: { id },
      data: { isActive: false },
    });

    return context.json({ message: "API key deactivated successfully" }, 200);
  } catch (response) {
    if (response instanceof Response) {
      return response;
    }

    return context.json({ message: "Internal server error" }, 500);
  }
}
