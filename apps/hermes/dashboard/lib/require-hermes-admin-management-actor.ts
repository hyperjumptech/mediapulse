import { prisma } from "@hermes/orchestration-database";
import type { Prisma } from "@hermes/orchestration-database";

import { getDashboardSession, type DashboardUser } from "@/lib/auth-dashboard";

export type HermesAdminManagementActor = {
  id: string;
  role: string;
  isActive: boolean;
  credentialVersion: number;
};

type HermesAdminManagementActorDb = Pick<typeof prisma.user, "findUnique">;

export type RequireHermesAdminManagementActorDependencies = {
  getSession?: typeof getDashboardSession;
  db?: HermesAdminManagementActorDb;
};

/**
 * Creates a gate that ensures the dashboard session belongs to an active Hermes `ADMIN` user (for mutating admin-management routes).
 *
 * @param dependencies - Injectable session reader and `user.findUnique` delegate.
 * @returns Async function returning `{ ok: true, session, actor }` or `{ ok: false }`.
 */
export const createRequireHermesAdminManagementActor = ({
  getSession = getDashboardSession,
  db = prisma.user,
}: RequireHermesAdminManagementActorDependencies = {}) => {
  /**
   * Resolves the current actor for admin-management mutations.
   *
   * @returns Authorized actor payload or a failure marker.
   */
  return async (): Promise<
    | { ok: true; session: DashboardUser; actor: HermesAdminManagementActor }
    | { ok: false }
  > => {
    const session = await getSession();
    if (!session) {
      return { ok: false };
    }

    const args = {
      where: { id: session.id },
      select: {
        id: true,
        role: true,
        isActive: true,
        credentialVersion: true,
      },
    } satisfies Prisma.UserFindUniqueArgs;

    const actor = await db.findUnique(args);
    if (!actor || actor.role !== "ADMIN" || !actor.isActive) {
      return { ok: false };
    }
    if (actor.credentialVersion !== session.credentialVersion) {
      return { ok: false };
    }

    return { ok: true, session, actor };
  };
};
