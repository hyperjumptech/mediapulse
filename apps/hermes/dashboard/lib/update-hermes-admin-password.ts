import type { Prisma } from "@hermes/orchestration-database";
import bcrypt from "bcrypt";

type UserUpdateDb = {
  user: {
    update: (args: Prisma.UserUpdateArgs) => Promise<unknown>;
  };
};

/**
 * Sets a new bcrypt password and increments `credentialVersion` so existing dashboard cookies invalidate.
 *
 * @param db - Prisma delegate or transaction client exposing `user.update`.
 * @param userId - Target user id.
 * @param plainPassword - New password (will be hashed).
 * @param hashPassword - Injectable hasher (default: bcrypt cost 10).
 */
export const updateHermesAdminPasswordWithCredentialBump = async (
  db: UserUpdateDb,
  userId: string,
  plainPassword: string,
  hashPassword: (plain: string) => Promise<string> = (plain) =>
    bcrypt.hash(plain, 10),
): Promise<void> => {
  const hashed = await hashPassword(plainPassword);
  const args = {
    where: { id: userId },
    data: {
      password: hashed,
      credentialVersion: { increment: 1 },
    },
  } satisfies Prisma.UserUpdateArgs;
  await db.user.update(args);
};
