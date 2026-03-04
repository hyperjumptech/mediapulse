import { prisma } from "@workspace/database";
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
  symbol: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdateTickerHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type UpdateTickerHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the update-ticker handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that updates a ticker (symbol, name).
 */
export const createUpdateTickerHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: UpdateTickerHandlerDependencies = {}): UpdateTickerHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { tickerId, symbol, name } = data.body;
    const updateData: { symbol?: string; name?: string } = {};
    if (symbol !== undefined) updateData.symbol = symbol;
    if (name !== undefined) updateData.name = name;

    await db.ticker.update({
      where: { id: tickerId },
      data: updateData,
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles update ticker: validates session and updates ticker in DB.
 */
export const handler: UpdateTickerHandler = createUpdateTickerHandler();
