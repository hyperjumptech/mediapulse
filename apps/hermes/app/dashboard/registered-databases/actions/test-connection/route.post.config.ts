import {
  decryptRegisteredDatabaseUrl,
  prisma,
} from "@workspace/orchestration-database";

import { PrismaClientWithSchema } from "@/lib/step-input-expansion";
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
  id: z.string().uuid().optional(),
  connectionString: z.string().optional(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type TestRegisteredDatabaseConnectionHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type TestRegisteredDatabaseConnectionHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates test-connection handler for registered database URLs.
 *
 * @param dependencies - Optional dependencies for tests.
 * @returns Handler that validates DB connectivity using SELECT 1.
 */
export const createTestRegisteredDatabaseConnectionHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: TestRegisteredDatabaseConnectionHandlerDependencies = {}): TestRegisteredDatabaseConnectionHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    let connectionString = data.body.connectionString?.trim() ?? "";
    if (!connectionString && data.body.id) {
      const row = await db.registeredDatabase.findUnique({
        where: { id: data.body.id },
        select: { encryptedConnectionString: true },
      });
      if (!row) {
        return errorResponse("Registered database not found");
      }
      connectionString = decryptRegisteredDatabaseUrl(
        row.encryptedConnectionString,
      );
    }

    if (!connectionString) {
      return errorResponse("connectionString is required");
    }

    const client = new PrismaClientWithSchema(connectionString);
    try {
      await client.$queryRawUnsafe("SELECT 1");
      return successResponse({ ok: true as const });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResponse(`Connection failed: ${message}`);
    } finally {
      await client.$disconnect();
    }
  };
};

export const handler: TestRegisteredDatabaseConnectionHandler =
  createTestRegisteredDatabaseConnectionHandler();
