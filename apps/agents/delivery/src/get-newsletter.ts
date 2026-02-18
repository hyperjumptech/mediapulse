import { prisma } from "@workspace/database";

export async function getNewsletter(tickerId: string) {
  const newsletter = await prisma.newsletter.findFirst({
    where: { tickerId },
    orderBy: { createdAt: "desc" },
  });

  if (!newsletter) {
    throw new Error("No newsletter found for this ticker");
  }

  return newsletter;
}
