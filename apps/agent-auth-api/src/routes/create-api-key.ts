import { validateBody } from "@workspace/api-utils";
import { prisma } from "@workspace/prisma";
import * as crypto from "crypto";
import { Context } from "hono";
import { z } from "zod";

const BodySchema = z.object({
  name: z.string(),
  user_id: z.string().uuid(),
});

export async function createAPIKey(context: Context) {
  try {
    const body = await validateBody(context, BodySchema);
    const key = crypto.randomBytes(32).toString("base64url");
    const hash = crypto.createHash("sha256").update(key).digest("hex");

    await prisma.aPIKey.create({
      data: {
        key: hash,
        name: body.name,
        userId: body.user_id,
      },
    });

    return context.json(
      { message: "API key created successfully", data: { key } },
      201,
    );
  } catch (response) {
    if (response instanceof Response) {
      return response;
    }

    return context.json({ message: "Internal server error" }, 500);
  }
}
