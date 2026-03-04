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
  symbol: z.string().min(1, "Symbol is required"),
  name: z.string().min(1, "Name is required"),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
});

type CreateTickerHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type CreateTickerHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the create-ticker handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that creates a single ticker and returns its id.
 */
export const createCreateTickerHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: CreateTickerHandlerDependencies = {}): CreateTickerHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { symbol, name } = data.body;
    const ticker = await db.ticker.create({
      data: { symbol, name },
    });

    return successResponse({ id: ticker.id });
  };
};

/**
 * Handles create ticker: validates session and creates ticker in DB.
 */
export const handler: CreateTickerHandler = createCreateTickerHandler();
