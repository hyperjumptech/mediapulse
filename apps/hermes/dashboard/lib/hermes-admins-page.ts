import { prisma, UserRole, type Prisma } from "@hermes/orchestration-database";

type HermesAdminsPageDb = Pick<typeof prisma.user, "findMany">;

export type HermesAdminListRow = Prisma.UserGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
    isActive: true;
    createdAt: true;
  };
}>;

export type LoadHermesAdminsForPageDependencies = {
  db?: HermesAdminsPageDb;
};

/**
 * Loads Hermes dashboard admin users for the admins settings page (no passwords).
 *
 * @param dependencies - Injectable `user.findMany` delegate (defaults to production Prisma).
 * @returns Admin rows ordered by email ascending.
 */
export const loadHermesAdminsForPage = async ({
  db = prisma.user,
}: LoadHermesAdminsForPageDependencies = {}): Promise<HermesAdminListRow[]> => {
  const args = {
    where: { role: UserRole.ADMIN },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { email: "asc" as const },
  } satisfies Prisma.UserFindManyArgs;

  return db.findMany(args);
};
