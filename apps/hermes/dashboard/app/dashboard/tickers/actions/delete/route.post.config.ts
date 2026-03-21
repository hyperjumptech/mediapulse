import { prisma } from "@mediapulse/database";
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
  tickerId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type DeleteTickerHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type DeleteTickerHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the delete-ticker handler with injectable dependencies for tests.
 * Deletes dependents (userTickers, newsletters, dataSources, searchQueries) then the ticker.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that deletes a ticker and its dependents.
 */
export const createDeleteTickerHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: DeleteTickerHandlerDependencies = {}): DeleteTickerHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { tickerId } = data.body;

    await db.$transaction(async (tx) => {
      await tx.userTicker.deleteMany({ where: { tickerId } });
      await tx.newsletter.deleteMany({ where: { tickerId } });
      await tx.dataSource.deleteMany({ where: { tickerId } });
      await tx.searchQuery.deleteMany({ where: { tickerId } });
      await tx.ticker.delete({ where: { id: tickerId } });
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles delete ticker: validates session and deletes ticker and dependents in a transaction.
 */
export const handler: DeleteTickerHandler = createDeleteTickerHandler();
