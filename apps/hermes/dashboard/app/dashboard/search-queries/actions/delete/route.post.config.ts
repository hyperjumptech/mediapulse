import { prisma } from "@workspace/mediapulse-database";
import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import {
  getDashboardSession,
  getDashboardSessionForRoute,
} from "@/lib/auth-dashboard";

const bodyValidator = z.object({
  searchQueryId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type DeleteSearchQueryHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: {
    dataSource: Pick<typeof prisma.dataSource, "count">;
    searchQuery: Pick<typeof prisma.searchQuery, "delete">;
  };
};

type DeleteSearchQueryHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the delete-search-query handler with injectable dependencies for tests.
 * Blocks deletion when linked data-source rows exist.
 *
 * @param dependencies - Optional getSession and db collaborators.
 * @returns Handler that deletes a search query by id.
 */
export const createDeleteSearchQueryHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: DeleteSearchQueryHandlerDependencies = {}): DeleteSearchQueryHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { searchQueryId } = data.body;

    const linkedDataSourceCount = await db.dataSource.count({
      where: { searchQueryId },
    });

    if (linkedDataSourceCount > 0) {
      return errorResponse(
        "Cannot delete this search query because it is used by data sources.",
      );
    }

    await db.searchQuery.delete({
      where: { id: searchQueryId },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles delete search query: validates session, blocks linked rows, then deletes by id.
 */
export const handler: DeleteSearchQueryHandler =
  createDeleteSearchQueryHandler();
