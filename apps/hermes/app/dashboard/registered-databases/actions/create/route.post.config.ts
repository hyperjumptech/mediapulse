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
  name: z.string().min(1, "Name is required"),
  connectionString: z.string().min(1, "Connection string is required"),
  allowlistedTables: z.string().optional(),
  isActive: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((value): boolean =>
      value === undefined ? true : value === true || value === "true",
    ),
  isDefault: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((value): boolean =>
      value === undefined ? false : value === true || value === "true",
    ),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
});

type CreateRegisteredDatabaseHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type CreateRegisteredDatabaseHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

const parseAllowlistedTables = (value?: string): string[] => {
  const trimmed = value?.trim();
  if (!trimmed) return [];
  const values = trimmed
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return values;
};

/**
 * Creates the create-registered-database handler.
 *
 * @param dependencies - Optional dependencies for tests.
 * @returns Handler that stores encrypted DB connection metadata.
 */
export const createCreateRegisteredDatabaseHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: CreateRegisteredDatabaseHandlerDependencies = {}): CreateRegisteredDatabaseHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { name, connectionString, allowlistedTables, isActive, isDefault } =
      data.body;

    const encryptedConnectionString =
      encryptRegisteredDatabaseUrl(connectionString);

    if (isDefault) {
      await db.registeredDatabase.updateMany({
        data: { isDefault: false },
      });
    }

    const created = await db.registeredDatabase.create({
      data: {
        name,
        encryptedConnectionString,
        allowlistedTables: parseAllowlistedTables(allowlistedTables),
        isActive,
        isDefault,
      },
    });

    return successResponse({ id: created.id });
  };
};

export const handler: CreateRegisteredDatabaseHandler =
  createCreateRegisteredDatabaseHandler();
