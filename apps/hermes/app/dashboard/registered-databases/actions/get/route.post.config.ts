import {
  decryptRegisteredDatabaseUrl,
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
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
  name: z.string(),
  connectionString: z.string(),
  allowlistedTables: z.array(z.string()),
  isActive: z.boolean(),
  isDefault: z.boolean(),
});

type GetRegisteredDatabaseHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type GetRegisteredDatabaseHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the get-registered-database handler.
 *
 * @param dependencies - Optional dependencies for tests.
 * @returns Handler returning full database connection details for edit.
 */
export const createGetRegisteredDatabaseHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: GetRegisteredDatabaseHandlerDependencies = {}): GetRegisteredDatabaseHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const row = await db.registeredDatabase.findUnique({
      where: { id: data.body.id },
    });
    if (!row) return errorResponse("Registered database not found");

    const decrypted = decryptRegisteredDatabaseUrl(
      row.encryptedConnectionString,
    );

    return successResponse({
      id: row.id,
      name: row.name,
      connectionString: decrypted,
      allowlistedTables: Array.isArray(row.allowlistedTables)
        ? row.allowlistedTables.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      isActive: row.isActive,
      isDefault: row.isDefault,
    });
  };
};

export const handler: GetRegisteredDatabaseHandler =
  createGetRegisteredDatabaseHandler();
