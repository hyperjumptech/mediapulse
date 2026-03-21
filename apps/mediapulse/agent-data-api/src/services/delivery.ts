import { prisma as mediapulsePrisma } from "@mediapulse/database";
import { prisma as orchestrationPrisma } from "@hermes/orchestration-database";

/**
 * Loads the latest newsletter for a ticker and subscriber emails for enabled `user_ticker` rows.
 * User rows live in the orchestration database; `user_ticker.user_id` references those ids without an FK.
 */
export async function getDeliveryData(tickerId: string) {
  const [newsletter, subscriptions] = await Promise.all([
    mediapulsePrisma.newsletter.findFirst({
      where: { tickerId },
      orderBy: { createdAt: "desc" },
    }),
    mediapulsePrisma.userTicker.findMany({
      where: { tickerId, enabled: true },
    }),
  ]);

  if (!newsletter) {
    return null;
  }

  const userIds = [...new Set(subscriptions.map((s) => s.userId))];
  const users =
    userIds.length === 0
      ? []
      : await orchestrationPrisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        });
  const emailByUserId = new Map(users.map((u) => [u.id, u.email] as const));

  const subscribers = subscriptions
    .map((subscription) => {
      const email = emailByUserId.get(subscription.userId);
      return email != null ? { email } : null;
    })
    .filter((s): s is { email: string } => s != null);

  return { newsletter, subscribers };
}

export async function postDelivery(_body: { userTickerId: string }) {
  // Acknowledge only; no DB write in current spec
}
