import { prismaClient } from "@hermes/orchestration-database/client";
import type { Prisma } from "@hermes/orchestration-database";
import { UserRole } from "@hermes/orchestration-database";

import { hashHermesAdminResetToken } from "@/lib/hermes-admin-reset-token";

export type LookupHermesAdminResetTokenReason =
  | "not_found"
  | "used"
  | "expired"
  | "not_eligible";

export type LookupHermesAdminResetTokenResult =
  | {
      ok: true;
      tokenId: string;
      userId: string;
    }
  | { ok: false; reason: LookupHermesAdminResetTokenReason };

type Db = Pick<typeof prismaClient, "hermesAdminPasswordResetToken">;

/**
 * Resolves a raw reset token from the email link to a usable row and eligible admin user.
 *
 * @param db - Prisma client (or transaction) with `hermesAdminPasswordResetToken`.
 * @param rawToken - Secret from the query string (before hashing).
 * @param now - Current time (injectable for tests).
 */
export const lookupHermesAdminResetToken = async (
  db: Db,
  rawToken: string,
  now: Date = new Date(),
): Promise<LookupHermesAdminResetTokenResult> => {
  const tokenHash = hashHermesAdminResetToken(rawToken);

  const args = {
    where: { tokenHash },
    include: {
      user: { select: { id: true, role: true, isActive: true } },
    },
  } satisfies Prisma.HermesAdminPasswordResetTokenFindUniqueArgs;

  const row = await db.hermesAdminPasswordResetToken.findUnique(args);
  if (!row) {
    return { ok: false, reason: "not_found" };
  }
  if (row.usedAt) {
    return { ok: false, reason: "used" };
  }
  if (row.expiresAt <= now) {
    return { ok: false, reason: "expired" };
  }
  if (row.user.role !== UserRole.ADMIN || row.user.isActive !== true) {
    return { ok: false, reason: "not_eligible" };
  }

  return {
    ok: true,
    tokenId: row.id,
    userId: row.userId,
  };
};
