import {
  encryptRegisteredDatabaseUrl,
  prisma,
} from "@workspace/orchestration-database";
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
  connectionString: z.string().optional(),
  allowlistedTables: z.string().optional(),
  isActive: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((value): boolean | undefined =>
      value === undefined ? undefined : value === true || value === "true",
    ),
  isDefault: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((value): boolean | undefined =>
      value === undefined ? undefined : value === true || value === "true",
    ),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdateRegisteredDatabaseHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type UpdateRegisteredDatabaseHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

const parseAllowlistedTables = (value?: string): string[] | undefined => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return [];
  const values = trimmed
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return values;
};

/**
 * Creates the update-registered-database handler.
 *
 * @param dependencies - Optional dependencies for tests.
 * @returns Handler that updates registered DB metadata.
 */
export const createUpdateRegisteredDatabaseHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: UpdateRegisteredDatabaseHandlerDependencies = {}): UpdateRegisteredDatabaseHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const {
      id,
      name,
      connectionString,
      allowlistedTables,
      isActive,
      isDefault,
    } = data.body;

    const existing = await db.registeredDatabase.findUnique({ where: { id } });
    if (!existing) return errorResponse("Registered database not found");

    const updateData: {
      name?: string;
      encryptedConnectionString?: string;
      allowlistedTables?: string[];
      isActive?: boolean;
      isDefault?: boolean;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (connectionString !== undefined && connectionString.trim().length > 0) {
      updateData.encryptedConnectionString =
        encryptRegisteredDatabaseUrl(connectionString);
    }
    const parsedAllowlistedTables = parseAllowlistedTables(allowlistedTables);
    if (parsedAllowlistedTables !== undefined) {
      updateData.allowlistedTables = parsedAllowlistedTables;
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    if (isDefault === true) {
      await db.registeredDatabase.updateMany({
        where: { NOT: { id } },
        data: { isDefault: false },
      });
    }

    await db.registeredDatabase.update({
      where: { id },
      data: updateData,
    });

    return successResponse({ ok: true as const });
  };
};

export const handler: UpdateRegisteredDatabaseHandler =
  createUpdateRegisteredDatabaseHandler();
