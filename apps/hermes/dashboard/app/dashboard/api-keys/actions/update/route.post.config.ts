import { prisma } from "@workspace/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import {
  getDashboardSession,
  getDashboardSessionForRoute,
} from "@/lib/auth-dashboard";

const bodyValidator = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  isActive: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((v): boolean | undefined =>
      v === undefined ? undefined : v === true || v === "true",
    ),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdateApiKeyHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type UpdateApiKeyHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the update-api-key handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that updates an API key (name, isActive).
 */
export const createUpdateApiKeyHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: UpdateApiKeyHandlerDependencies = {}): UpdateApiKeyHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { id, name, isActive } = data.body;

    const existing = await db.aPIKey.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse("API key not found");
    }

    const updateData: { name?: string; isActive?: boolean } = {};
    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;

    await db.aPIKey.update({
      where: { id },
      data: updateData,
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles update API key: validates session and updates name/isActive.
 */
export const handler: UpdateApiKeyHandler = createUpdateApiKeyHandler();
