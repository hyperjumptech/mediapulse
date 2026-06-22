import { prisma as mediapulsePrisma } from "@mediapulse/database";

/**
 * Loads the latest newsletter for a ticker and enabled `user_ticker` subscribers with emails.
 * When there is no newsletter, returns an empty payload (HTTP 200) so agents can skip gracefully.
 */
export async function getDeliveryData(tickerId: string) {
  const newsletter = await mediapulsePrisma.newsletter.findFirst({
    where: { tickerId },
    orderBy: { createdAt: "desc" },
    include: { ticker: true },
  });

  if (!newsletter) {
    return {
      newsletter: null,
      subscribers: [] as { userTickerId: string; email: string }[],
      deliveredUserTickerIds: [] as string[],
    };
  }

  const [checkpoints, subscriptions] = await Promise.all([
    mediapulsePrisma.newsletterDeliveryCheckpoint.findMany({
      where: { newsletterId: newsletter.id },
      select: { userTickerId: true },
    }),
    // Indonesian newsletters are not generated yet, so only English subscriptions are
    // delivered for now. This also avoids duplicate sends to a subscriber who registered
    // the same ticker in both languages (each row has its own delivery checkpoint).
    mediapulsePrisma.userTicker.findMany({
      where: {
        tickerId,
        enabled: true,
        language: "en",
        user: { enabled: true },
      },
      include: { user: true },
    }),
  ]);

  const subscribers = subscriptions
    .map((subscription) => {
      const email = subscription.user.email;
      return email != null && email !== ""
        ? { userTickerId: subscription.id, email }
        : null;
    })
    .filter((s): s is { userTickerId: string; email: string } => s != null);

  return {
    newsletter: {
      id: newsletter.id,
      subject: newsletter.subject,
      content: newsletter.content,
      symbol: newsletter.ticker.symbol,
    },
    subscribers,
    deliveredUserTickerIds: checkpoints.map((c) => c.userTickerId),
  };
}

/**
 * Records a successful delivery checkpoint for idempotent replays (unique per newsletter + subscriber).
 *
 * @param body - User-ticker row id, newsletter id, optional Resend message id.
 */
export async function postDelivery(body: {
  userTickerId: string;
  newsletterId: string;
  resendEmailId?: string;
}) {
  await mediapulsePrisma.newsletterDeliveryCheckpoint.upsert({
    where: {
      newsletterId_userTickerId: {
        newsletterId: body.newsletterId,
        userTickerId: body.userTickerId,
      },
    },
    create: {
      newsletterId: body.newsletterId,
      userTickerId: body.userTickerId,
      ...(body.resendEmailId !== undefined
        ? { resendEmailId: body.resendEmailId }
        : {}),
    },
    update: {
      deliveredAt: new Date(),
      ...(body.resendEmailId !== undefined
        ? { resendEmailId: body.resendEmailId }
        : {}),
    },
  });
}
