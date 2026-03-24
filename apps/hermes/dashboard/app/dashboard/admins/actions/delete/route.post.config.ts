import { prisma, UserRole } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";
import { createRequireHermesAdminManagementActor } from "@/lib/require-hermes-admin-management-actor";

const bodyValidator = z.object({
  id: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

const defaultRequireActor = createRequireHermesAdminManagementActor();

type DeleteAdminHandlerDependencies = {
  requireHermesAdminManagementActor?: typeof defaultRequireActor;
  db?: typeof prisma;
};

type DeleteAdminHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the handler that deletes a Hermes `ADMIN` user.
 *
 * @param dependencies - Injectable actor gate and Prisma client.
 * @returns Route handler.
 */
export const createDeleteAdminHandler = ({
  requireHermesAdminManagementActor = defaultRequireActor,
  db = prisma,
}: DeleteAdminHandlerDependencies = {}): DeleteAdminHandler => {
  return async (data) => {
    const gate = await requireHermesAdminManagementActor();
    if (!gate.ok) {
      return errorResponse("Unauthorized");
    }

    const { session } = gate;
    const { id } = data.body;

    if (id === session.id) {
      return errorResponse("You cannot delete your own account");
    }

    const adminCount = await db.user.count({
      where: { role: UserRole.ADMIN },
    });
    if (adminCount <= 1) {
      return errorResponse("Cannot delete the last admin user");
    }

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target || target.role !== UserRole.ADMIN) {
      return errorResponse("Admin not found");
    }

    await db.user.delete({ where: { id } });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles delete admin: removes the user row.
 */
export const handler: DeleteAdminHandler = createDeleteAdminHandler();
