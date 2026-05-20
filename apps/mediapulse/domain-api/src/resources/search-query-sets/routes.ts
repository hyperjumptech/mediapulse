/**
 * HTTP handlers for search-query-sets: list, detail, create, update, and delete.
 */

import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { z } from "zod";

import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import {
  createSearchQuerySet,
  deleteSearchQuerySet,
  SearchQuerySetPersistError,
  updateSearchQuerySet,
} from "../../lib/search-query-set-persist";
import { parsePagination } from "../../lib/list-pagination";
import { mapRowToDetailItem, detailInclude } from "./detail-mapper";
import { searchQuerySetsHermesPathSegment } from "./dashboard-page";
import { listInclude, mapRowToListItem } from "./list-mapper";
import { parseJsonArrayField, parseJsonObjectField } from "./parse-json-fields";
import {
  searchQuerySetCreateBodySchema,
  searchQuerySetUpdateBodySchema,
} from "./write-body-schemas";

/**
 * Maps table-v1 `sortBy` to Prisma `orderBy` for search query sets.
 *
 * @param sortBy - Column key from the manifest.
 * @param sortDir - Sort direction.
 */
const resolveListOrderBy = (
  sortBy: string | undefined,
  sortDir: Prisma.SortOrder,
): Prisma.SearchQuerySetOrderByWithRelationInput => {
  switch (sortBy) {
    case "generatedAt":
      return { generatedAt: sortDir };
    case "isActive":
      return { isActive: sortDir };
    case "queryCount":
      return { searchQueries: { _count: sortDir } };
    case "createdAt":
      return { createdAt: sortDir };
    default:
      return { generatedAt: "desc" };
  }
};

/**
 * Normalizes optional agent job id from form bodies (empty string → undefined).
 *
 * @param raw - Raw `agentJobId` field.
 */
const normalizeAgentJobId = (raw: string | undefined): string | undefined => {
  const trimmed = raw?.trim();
  return trimmed === "" ? undefined : trimmed;
};

/**
 * Hermes `table-v1` API for versioned search query sets (full CRUD + detail).
 */
export const searchQuerySetsRoutes = new Hono();

searchQuerySetsRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const query = c.req.query("q")?.trim();
  const sortBy = c.req.query("sortBy");
  const sortDir: Prisma.SortOrder =
    c.req.query("sortDir") === "asc" ? "asc" : "desc";
  const skip = (page - 1) * pageSize;

  const tickerFilter = z
    .string()
    .uuid()
    .safeParse(c.req.query("tickerId")?.trim() ?? "");
  const isActiveRaw = c.req.query("isActive")?.trim();
  const isActiveFilter =
    isActiveRaw === "true" ? true : isActiveRaw === "false" ? false : undefined;

  const filterParts: Prisma.SearchQuerySetWhereInput[] = [];
  if (query) {
    filterParts.push({
      OR: [
        { id: { contains: query, mode: "insensitive" as const } },
        { generationSource: { contains: query, mode: "insensitive" as const } },
        { agentJobId: { contains: query, mode: "insensitive" as const } },
        {
          ticker: {
            symbol: { contains: query, mode: "insensitive" as const },
          },
        },
        {
          ticker: { name: { contains: query, mode: "insensitive" as const } },
        },
      ],
    });
  }
  if (tickerFilter.success) {
    filterParts.push({ tickerId: tickerFilter.data });
  }
  if (isActiveFilter !== undefined) {
    filterParts.push({ isActive: isActiveFilter });
  }

  const where =
    filterParts.length === 0
      ? undefined
      : filterParts.length === 1
        ? filterParts[0]
        : { AND: filterParts };

  const orderBy = resolveListOrderBy(sortBy, sortDir);

  const findManyArgs = {
    where,
    include: listInclude,
    skip,
    take: pageSize,
    orderBy,
  } satisfies Prisma.SearchQuerySetFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.searchQuerySet.findMany(findManyArgs),
    prisma.searchQuerySet.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

searchQuerySetsRoutes.get("/meta", (c) => {
  const meta = buildMetaPayloadForPathSegment(searchQuerySetsHermesPathSegment);
  if (!meta) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }
  return c.json(meta);
});

searchQuerySetsRoutes.get("/:id", async (c) => {
  const row = await prisma.searchQuerySet.findUnique({
    where: { id: c.req.param("id") },
    include: detailInclude,
  } satisfies Prisma.SearchQuerySetFindUniqueArgs);

  if (!row) {
    return c.json({ message: "Search query set not found" }, 404);
  }

  return c.json(mapRowToDetailItem(row));
});

searchQuerySetsRoutes.post("/", async (c) => {
  const raw: unknown = await c.req.json();
  if (!raw || typeof raw !== "object") {
    return c.json({ message: "Invalid request body" }, 400);
  }
  const body = raw as Record<string, unknown>;

  const strategyParsed = parseJsonObjectField(
    body.strategySnapshot,
    "strategySnapshot",
  );
  if (!strategyParsed.ok) {
    return c.json({ message: strategyParsed.message }, 400);
  }

  const queriesParsed = parseJsonArrayField(body.queries, "queries");
  if (!queriesParsed.ok) {
    return c.json({ message: queriesParsed.message }, 400);
  }

  const normalized = {
    ...body,
    strategySnapshot: strategyParsed.value,
    queries: queriesParsed.value,
    agentJobId: normalizeAgentJobId(
      typeof body.agentJobId === "string" ? body.agentJobId : undefined,
    ),
  };

  const parsed = searchQuerySetCreateBodySchema.safeParse(normalized);
  if (!parsed.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const created = await createSearchQuerySet({
      tickerId: parsed.data.tickerId,
      isActive: parsed.data.isActive,
      generationSource: parsed.data.generationSource,
      strategySnapshot: parsed.data.strategySnapshot,
      agentJobId: parsed.data.agentJobId,
      queries: parsed.data.queries,
    });
    return c.json({ id: created.id }, 201);
  } catch (error) {
    if (error instanceof SearchQuerySetPersistError) {
      return c.json({ message: error.message }, error.status);
    }
    throw error;
  }
});

searchQuerySetsRoutes.patch("/:id", async (c) => {
  const raw: unknown = await c.req.json();
  if (!raw || typeof raw !== "object") {
    return c.json({ message: "Invalid request body" }, 400);
  }
  const body = raw as Record<string, unknown>;

  const strategyParsed = parseJsonObjectField(
    body.strategySnapshot,
    "strategySnapshot",
  );
  if (!strategyParsed.ok) {
    return c.json({ message: strategyParsed.message }, 400);
  }

  let queries: unknown = undefined;
  if (body.queries !== undefined && body.queries !== null) {
    if (typeof body.queries === "string" && body.queries.trim() === "") {
      // Omit empty textarea — leave existing queries unchanged.
    } else {
      const queriesParsed = parseJsonArrayField(body.queries, "queries");
      if (!queriesParsed.ok) {
        return c.json({ message: queriesParsed.message }, 400);
      }
      queries = queriesParsed.value;
    }
  }

  const normalized = {
    generationSource: body.generationSource,
    isActive: body.isActive,
    strategySnapshot: strategyParsed.value,
    agentJobId: normalizeAgentJobId(
      typeof body.agentJobId === "string" ? body.agentJobId : undefined,
    ),
    ...(queries !== undefined ? { queries } : {}),
  };

  const parsed = searchQuerySetUpdateBodySchema.safeParse(normalized);
  if (!parsed.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const updated = await updateSearchQuerySet(c.req.param("id"), {
      isActive: parsed.data.isActive,
      generationSource: parsed.data.generationSource,
      strategySnapshot: parsed.data.strategySnapshot,
      agentJobId: parsed.data.agentJobId ?? null,
      queries: parsed.data.queries,
    });
    return c.json({ id: updated.id });
  } catch (error) {
    if (error instanceof SearchQuerySetPersistError) {
      return c.json({ message: error.message }, error.status);
    }
    throw error;
  }
});

searchQuerySetsRoutes.delete("/:id", async (c) => {
  try {
    await deleteSearchQuerySet(c.req.param("id"));
    return c.json({ ok: true });
  } catch (error) {
    if (error instanceof SearchQuerySetPersistError) {
      return c.json({ message: error.message }, error.status);
    }
    throw error;
  }
});
