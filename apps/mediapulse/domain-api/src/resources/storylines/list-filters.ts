import { Prisma } from "@mediapulse/database";

export type StorylineListFilters = {
  q?: string;
  kind?: "story" | "format";
  locked?: boolean;
  tickerId?: string;
  from?: Date;
  to?: Date;
};

export type StorylineListSortDir = "asc" | "desc";

export type StorylineListSortField =
  | "lastObservedAt"
  | "firstObservedAt"
  | "name"
  | "developmentCount";

export const parseStorylineKind = (
  raw: string | undefined,
): "story" | "format" | undefined => {
  if (raw === "story" || raw === "format") return raw;

  return undefined;
};

export const parseStorylineLocked = (
  raw: string | undefined,
): boolean | undefined => {
  if (raw === "true") return true;
  if (raw === "false") return false;

  return undefined;
};

export const parseStorylineSortBy = (
  raw: string | undefined,
): StorylineListSortField | undefined => {
  if (
    raw === "lastObservedAt" ||
    raw === "firstObservedAt" ||
    raw === "name" ||
    raw === "developmentCount"
  ) {
    return raw;
  }

  return undefined;
};

export function buildStorylineListWhere(
  filters: StorylineListFilters,
): Prisma.StorylineWhereInput {
  const parts: Prisma.StorylineWhereInput[] = [];

  if (filters.q && filters.q.trim().length > 0) {
    const term = filters.q.trim();
    parts.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        {
          anchors: {
            some: { anchor: { contains: term, mode: "insensitive" } },
          },
        },
      ],
    });
  }

  if (filters.kind) {
    parts.push({ kind: filters.kind });
  }

  if (filters.locked !== undefined) {
    parts.push({ locked: filters.locked });
  }

  if (filters.tickerId) {
    parts.push({ tickers: { some: { tickerId: filters.tickerId } } });
  }

  const lastObservedAt: { gte?: Date; lte?: Date } = {};
  if (filters.from && !Number.isNaN(filters.from.getTime())) {
    lastObservedAt.gte = filters.from;
  }
  if (filters.to && !Number.isNaN(filters.to.getTime())) {
    lastObservedAt.lte = filters.to;
  }
  if (lastObservedAt.gte !== undefined || lastObservedAt.lte !== undefined) {
    parts.push({ lastObservedAt });
  }

  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0] ?? {};

  return { AND: parts };
}

export function buildStorylineListOrderBy(
  sortBy: StorylineListSortField | undefined,
  sortDir: StorylineListSortDir | undefined,
): Prisma.StorylineOrderByWithRelationInput {
  const dir: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  if (sortBy === "name") return { name: dir };
  if (sortBy === "firstObservedAt") return { firstObservedAt: dir };
  if (sortBy === "developmentCount") return { developments: { _count: dir } };

  return { lastObservedAt: dir };
}
