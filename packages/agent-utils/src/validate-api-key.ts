import * as crypto from "crypto";
import { prisma } from "@workspace/prisma";

export async function verifyAPIKey(key: string) {
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const apiKey = await prisma.aPIKey.findUnique({
    where: { key: hash, isActive: true },
    select: { userId: true },
  });

  return !!apiKey?.userId;
}
