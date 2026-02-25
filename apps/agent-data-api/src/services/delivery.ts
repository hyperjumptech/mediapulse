import { prisma } from "@workspace/database";

export async function getDeliveryData(tickerId: string) {
  const [newsletter, subscriptions] = await Promise.all([
    prisma.newsletter.findFirst({
      where: { tickerId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userTicker.findMany({
      where: { tickerId, enabled: true },
      include: { user: true },
    }),
  ]);

  if (!newsletter) {
    return null;
  }

  const subscribers = subscriptions.map((s) => ({ email: s.user.email }));

  return { newsletter, subscribers };
}

export async function postDelivery(_body: { userTickerId: string }) {
  // Acknowledge only; no DB write in current spec
}
