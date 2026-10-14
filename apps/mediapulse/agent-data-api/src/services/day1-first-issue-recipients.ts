import type { PrismaClient } from "@mediapulse/database";

export type Day1FirstIssueRecipientsDb = Pick<
  PrismaClient,
  "day1NewsletterDispatch" | "newsletterDeliveryCheckpoint"
>;

export type FindDay1FirstIssueRecipientsInput = {
  tickerId: string;
  newsletterId: string;
  scheduleExecutionId: string | undefined;
};

export const findDay1FirstIssueRecipients = async (
  db: Day1FirstIssueRecipientsDb,
  {
    tickerId,
    newsletterId,
    scheduleExecutionId,
  }: FindDay1FirstIssueRecipientsInput,
): Promise<string[]> => {
  if (scheduleExecutionId === undefined) {
    return [];
  }
  const dispatches = await db.day1NewsletterDispatch.findMany({
    where: { hermesExecutionId: scheduleExecutionId, tickerId },
    select: { userTickerId: true, userTicker: { select: { userId: true } } },
  });
  const recipients = await Promise.all(
    dispatches.map(async (dispatch) => {
      const earlierDeliveryCount = await db.newsletterDeliveryCheckpoint.count({
        where: {
          newsletterId: { not: newsletterId },
          resendEmailId: { not: null },
          userTicker: { userId: dispatch.userTicker.userId, tickerId },
        },
      });

      return earlierDeliveryCount === 0 ? dispatch.userTickerId : null;
    }),
  );
  const firstIssueRecipients = recipients.filter(
    (userTickerId): userTickerId is string => userTickerId !== null,
  );

  return [...new Set(firstIssueRecipients)];
};
