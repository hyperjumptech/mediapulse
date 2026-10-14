import type { PrismaClient } from "@mediapulse/database";

export type Day1WelcomeClaimDb = Pick<PrismaClient, "day1NewsletterDispatch">;

export const DAY1_WELCOME_CLAIM_TTL_MS = 30 * 60_000;

export const claimDay1Welcome = async (
  db: Day1WelcomeClaimDb,
  { dispatchId }: { dispatchId: string },
  now: Date = new Date(),
): Promise<{ claimed: boolean }> => {
  const staleBefore = new Date(now.getTime() - DAY1_WELCOME_CLAIM_TTL_MS);
  const result = await db.day1NewsletterDispatch.updateMany({
    where: {
      id: dispatchId,
      kind: "welcome",
      welcomeSentAt: null,
      OR: [
        { welcomeClaimedAt: null },
        { welcomeClaimedAt: { lt: staleBefore } },
      ],
    },
    data: { welcomeClaimedAt: now },
  });

  return { claimed: result.count === 1 };
};

export const releaseDay1WelcomeClaim = async (
  db: Day1WelcomeClaimDb,
  { dispatchId }: { dispatchId: string },
): Promise<{ released: boolean }> => {
  const result = await db.day1NewsletterDispatch.updateMany({
    where: { id: dispatchId, welcomeSentAt: null },
    data: { welcomeClaimedAt: null },
  });

  return { released: result.count > 0 };
};

export const recordDay1WelcomeSent = async (
  db: Day1WelcomeClaimDb,
  { dispatchId, resendEmailId }: { dispatchId: string; resendEmailId?: string },
  now: Date = new Date(),
): Promise<void> => {
  await db.day1NewsletterDispatch.update({
    where: { id: dispatchId },
    data: { welcomeSentAt: now, welcomeResendEmailId: resendEmailId ?? null },
  });
};
