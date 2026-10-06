import type { Prisma, PublisherNameSource } from "@mediapulse/database";

export type PublisherListSortField = "displayName" | "domain" | "lastSeenAt";

export type PublisherListFilters = {
  q?: string;
  nameSource?: PublisherNameSource;
};

const publisherListSortFields: readonly PublisherListSortField[] = [
  "displayName",
  "domain",
  "lastSeenAt",
];

export const parsePublisherListSortField = (
  raw: string | undefined,
): PublisherListSortField | undefined =>
  publisherListSortFields.find((field) => field === raw);

export const buildPublisherListWhere = (
  filters: PublisherListFilters,
): Prisma.PublisherWhereInput => {
  const parts: Prisma.PublisherWhereInput[] = [];

  const query = filters.q?.trim();
  if (query !== undefined && query.length > 0) {
    parts.push({
      OR: [
        { displayName: { contains: query, mode: "insensitive" } },
        { domain: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  if (filters.nameSource !== undefined) {
    parts.push({ nameSource: filters.nameSource });
  }

  if (parts.length === 0) {
    return {};
  }

  return parts.length === 1 ? (parts[0] ?? {}) : { AND: parts };
};

export const buildPublisherListOrderBy = (
  sortBy: PublisherListSortField | undefined,
  sortDir: Prisma.SortOrder,
): Prisma.PublisherOrderByWithRelationInput[] => {
  const field = sortBy ?? "lastSeenAt";
  const direction: Prisma.SortOrder = sortBy === undefined ? "desc" : sortDir;

  if (field === "domain") {
    return [{ domain: direction }];
  }

  return [{ [field]: direction }, { domain: "asc" }];
};
