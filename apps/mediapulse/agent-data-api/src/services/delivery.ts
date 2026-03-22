import { prisma as mediapulsePrisma } from "@mediapulse/database";

/**
 * Loads the latest newsletter for a ticker and subscriber emails for enabled `user_ticker` rows.
 * Emails come from `MediapulseUser` rows (Mediapulse domain), not Hermes orchestration admins.
 */
export async function getDeliveryData(tickerId: string) {
  const [newsletter, subscriptions] = await Promise.all([
    mediapulsePrisma.newsletter.findFirst({
      where: { tickerId },
      orderBy: { createdAt: "desc" },
    }),
    mediapulsePrisma.userTicker.findMany({
      where: { tickerId, enabled: true },
      include: { user: true },
    }),
  ]);

  if (!newsletter) {
    return null;
  }

  const subscribers = subscriptions
    .map((subscription) => {
      const email = subscription.user.email;
      return email != null && email !== "" ? { email } : null;
    })
    .filter((s): s is { email: string } => s != null);

  return { newsletter, subscribers };
}

export async function postDelivery(_body: { userTickerId: string }) {
  // Acknowledge only; no DB write in current spec
}
