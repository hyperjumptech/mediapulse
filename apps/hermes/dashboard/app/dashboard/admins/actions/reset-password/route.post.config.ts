import { prisma, UserRole } from "@hermes/orchestration-database";
import bcrypt from "bcrypt";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardPrincipalForRoute } from "@/lib/auth-dashboard";
import { createRequireHermesAdminManagementActor } from "@/lib/require-hermes-admin-management-actor";
import { updateHermesAdminPasswordWithCredentialBump } from "@/lib/update-hermes-admin-password";

const bodyValidator = z.object({
  id: z.string().uuid(),
  newPassword: z.string().min(4),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

const defaultRequireActor = createRequireHermesAdminManagementActor();

type ResetAdminPasswordHandlerDependencies = {
  requireHermesAdminManagementActor?: typeof defaultRequireActor;
  db?: typeof prisma;
  hashPassword?: (plain: string) => Promise<string>;
};

type ResetAdminPasswordHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the handler that sets a new bcrypt password for a Hermes `ADMIN` user.
 *
 * @param dependencies - Injectable actor gate, Prisma client, and password hasher.
 * @returns Route handler.
 */
export const createResetAdminPasswordHandler = ({
  requireHermesAdminManagementActor = defaultRequireActor,
  db = prisma,
  hashPassword = (plain: string) => bcrypt.hash(plain, 10),
}: ResetAdminPasswordHandlerDependencies = {}): ResetAdminPasswordHandler => {
  return async (data) => {
    const gate = await requireHermesAdminManagementActor();
    if (!gate.ok) {
      return errorResponse("Unauthorized");
    }

    const { id, newPassword } = data.body;

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target || target.role !== UserRole.ADMIN) {
      return errorResponse("Admin not found");
    }

    await updateHermesAdminPasswordWithCredentialBump(
      db,
      id,
      newPassword,
      hashPassword,
    );

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles admin password reset.
 */
export const handler: ResetAdminPasswordHandler =
  createResetAdminPasswordHandler();
