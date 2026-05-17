import { prisma, UserRole } from "@hermes/orchestration-database";
import bcrypt from "bcrypt";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { createRequireHermesAdminManagementActor } from "@/lib/require-hermes-admin-management-actor";

const bodyValidator = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email(),
  password: z.string().min(4),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
});

const defaultRequireActor = createRequireHermesAdminManagementActor();

type CreateAdminHandlerDependencies = {
  requireHermesAdminManagementActor?: typeof defaultRequireActor;
  db?: typeof prisma;
  hashPassword?: (plain: string) => Promise<string>;
};

type CreateAdminHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

const isPrismaUniqueViolation = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
};

/**
 * Creates the handler that provisions a new Hermes `ADMIN` user.
 *
 * @param dependencies - Injectable actor gate, Prisma client, and password hasher.
 * @returns Route handler.
 */
export const createCreateAdminHandler = ({
  requireHermesAdminManagementActor = defaultRequireActor,
  db = prisma,
  hashPassword = (plain: string) => bcrypt.hash(plain, 10),
}: CreateAdminHandlerDependencies = {}): CreateAdminHandler => {
  return async (data) => {
    const gate = await requireHermesAdminManagementActor();
    if (!gate.ok) {
      return errorResponse("Unauthorized");
    }

    const { name, email, password } = data.body;
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const hashed = await hashPassword(password);
      const created = await db.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password: hashed,
          role: UserRole.ADMIN,
          isActive: true,
        },
        select: { id: true },
      });
      return successResponse({ id: created.id });
    } catch (error: unknown) {
      if (isPrismaUniqueViolation(error)) {
        return errorResponse("An admin with this email already exists");
      }
      throw error;
    }
  };
};

/**
 * Handles create admin: active admin actor required; creates `ADMIN` with hashed password.
 */
export const handler: CreateAdminHandler = createCreateAdminHandler();
