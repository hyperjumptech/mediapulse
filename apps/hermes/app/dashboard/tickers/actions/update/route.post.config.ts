import { prisma, Prisma } from "@workspace/database";
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

/**
 * Parses optional JSON string into a plain object or null for ticker metadata.
 * Rejects arrays and non-object values; invalid JSON throws so validation fails.
 */
const metadataSchema = z
  .string()
  .optional()
  .transform((s): Record<string, unknown> | null | undefined => {
    if (s === undefined || s === "") return undefined;
    try {
      const v = JSON.parse(s) as unknown;
      if (v === null) return null;
      if (typeof v === "object" && !Array.isArray(v))
        return v as Record<string, unknown>;
      throw new Error("Metadata must be a JSON object or null");
    } catch (err) {
      throw err instanceof Error ? err : new Error("Invalid JSON in metadata");
    }
  });

const bodyValidator = z.object({
  tickerId: z.string().uuid(),
  symbol: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  metadata: metadataSchema,
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
 * @returns Handler that updates a ticker (symbol, name, metadata).
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

    const { tickerId, symbol, name, metadata } = data.body;
    const updateData: Parameters<typeof db.ticker.update>[0]["data"] = {};
    if (symbol !== undefined) updateData.symbol = symbol;
    if (name !== undefined) updateData.name = name;
    if (metadata !== undefined)
      updateData.metadata =
        metadata === null ? Prisma.DbNull : (metadata as Prisma.InputJsonValue);

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
