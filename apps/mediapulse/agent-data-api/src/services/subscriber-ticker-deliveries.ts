import type { PrismaClient } from "@mediapulse/database";

export type SubscriberTickerDeliveriesDb = Pick<
  PrismaClient,
  "newsletterDeliveryCheckpoint"
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
