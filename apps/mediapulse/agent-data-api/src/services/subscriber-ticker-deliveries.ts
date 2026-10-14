import type { PrismaClient } from "@mediapulse/database";

export type SubscriberTickerDeliveriesDb = Pick<
  PrismaClient,
  "newsletterDeliveryCheckpoint"
>;

export type SubscriberTickerWelcomesDb = Pick<
  PrismaClient,
  "day1NewsletterDispatch"
>;

export type SubscriberTicker = {
  userId: string;
  tickerId: string;
};

export const countSubscriberTickerDeliveries = (
  db: SubscriberTickerDeliveriesDb,
  { userId, tickerId }: SubscriberTicker,
): Promise<number> =>
  db.newsletterDeliveryCheckpoint.count({
    where: {
      resendEmailId: { not: null },
      userTicker: { userId, tickerId },
    },
  });

export const countSubscriberTickerWelcomes = (
  db: SubscriberTickerWelcomesDb,
  { userId, tickerId }: SubscriberTicker,
): Promise<number> =>
  db.day1NewsletterDispatch.count({
    where: {
      welcomeClaimedAt: { not: null },
      userTicker: { userId, tickerId },
    },
  });
