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
  active: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((v) => v === true || v === "true"),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

const defaultRequireActor = createRequireHermesAdminManagementActor();

type SetActiveAdminHandlerDependencies = {
  requireHermesAdminManagementActor?: typeof defaultRequireActor;
  db?: typeof prisma;
};

type SetActiveAdminHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the handler that enables or disables a Hermes `ADMIN` login (`isActive`).
 *
 * @param dependencies - Injectable actor gate and Prisma client.
 * @returns Route handler.
 */
export const createSetActiveAdminHandler = ({
  requireHermesAdminManagementActor = defaultRequireActor,
  db = prisma,
}: SetActiveAdminHandlerDependencies = {}): SetActiveAdminHandler => {
  return async (data) => {
    const gate = await requireHermesAdminManagementActor();
    if (!gate.ok) {
      return errorResponse("Unauthorized");
    }

    const { session } = gate;
    const { id, active } = data.body;

    if (!active && id === session.id) {
      return errorResponse("You cannot disable your own account");
    }

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true, isActive: true },
    });
    if (!target || target.role !== UserRole.ADMIN) {
      return errorResponse("Admin not found");
    }

    if (!active && target.isActive) {
      const otherActiveAdmins = await db.user.count({
        where: {
          role: UserRole.ADMIN,
          isActive: true,
          id: { not: id },
        },
      });
      if (otherActiveAdmins === 0) {
        return errorResponse("Cannot disable the last active admin");
      }
    }

    await db.user.update({
      where: { id },
      data: { isActive: active },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles set-active for an admin user.
 */
export const handler: SetActiveAdminHandler = createSetActiveAdminHandler();
