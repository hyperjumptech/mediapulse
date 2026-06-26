import { prisma as mediapulsePrisma } from "@mediapulse/database";

import { isPrismaUniqueViolation } from "./is-prisma-unique-violation.js";

/**
 * Atomically claims a recipient before sending by inserting the delivery checkpoint row.
 * The unique `(newsletterId, userTickerId)` constraint decides the winner of concurrent runs:
 * the insert succeeds for exactly one caller, and a duplicate-key violation means another run
 * already owns (or completed) the send.
 *
 * @param body - User-ticker row id and newsletter id.
 * @returns `{ claimed: true }` when this caller may send, `{ claimed: false }` when it must not.
 */
export async function claimDelivery(body: {
  userTickerId: string;
  newsletterId: string;
}): Promise<{ claimed: boolean }> {
  try {
    await mediapulsePrisma.newsletterDeliveryCheckpoint.create({
      data: {
        newsletterId: body.newsletterId,
        userTickerId: body.userTickerId,
      },
    });

    return { claimed: true };
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return { claimed: false };
    }

    throw error;
  }
}

/**
 * Releases a claim that never completed a send so the recipient can be retried. Only removes
 * unfinalized claims (no `resendEmailId`), so a recorded delivery is never deleted by accident.
 *
 * @param body - User-ticker row id and newsletter id.
 * @returns `{ released: true }` when an unfinalized claim was removed.
 */
export async function releaseDeliveryClaim(body: {
  userTickerId: string;
  newsletterId: string;
}): Promise<{ released: boolean }> {
  const result = await mediapulsePrisma.newsletterDeliveryCheckpoint.deleteMany(
    {
      where: {
        newsletterId: body.newsletterId,
        userTickerId: body.userTickerId,
        resendEmailId: null,
      },
    },
  );

  return { released: result.count > 0 };
}
