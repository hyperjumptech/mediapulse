import type { TableV1MetaResponse } from "@hermes/domain-contract";

export type DomainTableSearchParams = {
  page?: string;
  size?: string;
  q?: string;
  sort?: string;
  dir?: string;
  tickerId?: string;
  typeId?: string;
  from?: string;
  to?: string;
};

export type DomainTableListParamsParsed = {
  page: number;
  pageSize: number;
  query?: string;
  sortBy?: string;
  sortDir: "asc" | "desc";
  tickerId?: string;
  typeId?: string;
  from?: string;
  to?: string;
};

/**
 * Builds filter query params to preserve in pagination, search, and sort links.
 *
 * @param params - Parsed list params with optional filter fields.
 * @returns Record of non-empty filter entries.
 */
export const buildDomainTableFilterExtraParams = (
  params: Pick<
    DomainTableListParamsParsed,
    "tickerId" | "typeId" | "from" | "to"
  >,
): Record<string, string> => {
  const extra: Record<string, string> = {};
  if (params.tickerId) extra.tickerId = params.tickerId;
  if (params.typeId) extra.typeId = params.typeId;
  if (params.from) extra.from = params.from;
  if (params.to) extra.to = params.to;
  return extra;
};

/**
 * Parses route search params into pagination, search, and filter values.
 *
 * @param searchParams - Route search params.
 * @returns Parsed pagination and filter values (sort resolved separately via meta).
 */
export const parseDomainTableSearchParams = (
  searchParams: DomainTableSearchParams,
): Omit<DomainTableListParamsParsed, "sortBy" | "sortDir"> => {
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.size ?? "15", 10) || 15),
  );
  const query = searchParams.q?.trim() || undefined;
  const tickerId = searchParams.tickerId?.trim() || undefined;
  const typeId = searchParams.typeId?.trim() || undefined;
  const from = searchParams.from?.trim() || undefined;
  const to = searchParams.to?.trim() || undefined;
  return { page, pageSize, query, tickerId, typeId, from, to };
};

/**
 * Resolves list sort from URL params or manifest `defaultSort`.
 *
 * @param searchParams - Route search params (`sort`, `dir`).
 * @param meta - Table meta with `sortableFields` and optional `defaultSort`.
 * @returns `sortBy` and `sortDir` for the domain list API.
 */
export const resolveDomainTableListSort = (
  searchParams: Pick<DomainTableSearchParams, "sort" | "dir">,
  meta: Pick<TableV1MetaResponse, "sortableFields" | "defaultSort">,
): { sortBy?: string; sortDir: "asc" | "desc" } => {
  const urlSort = searchParams.sort?.trim();
  if (urlSort && meta.sortableFields.includes(urlSort)) {
    return {
      sortBy: urlSort,
      sortDir: searchParams.dir === "asc" ? "asc" : "desc",
    };
  }
  if (meta.defaultSort) {
    return {
      sortBy: meta.defaultSort.sortBy,
      sortDir: meta.defaultSort.sortDir,
    };
  }
  return { sortBy: undefined, sortDir: "asc" };
};

/**
 * Merges parsed search params with resolved sort for list API calls.
 *
 * @param searchParams - Route search params.
 * @param meta - Table meta used to resolve default sort.
 * @returns Full list params for `getDomainTableList`.
 */
export const buildDomainTableListParams = (
  searchParams: DomainTableSearchParams,
  meta: Pick<TableV1MetaResponse, "sortableFields" | "defaultSort">,
): DomainTableListParamsParsed => {
  const base = parseDomainTableSearchParams(searchParams);
  const sort = resolveDomainTableListSort(searchParams, meta);
  return { ...base, ...sort };
};

/**
 * Query params to preserve across search, sort, pagination, and filter forms.
 *
 * @param params - Parsed list params including resolved sort.
 * @returns URL query keys (`sort`, `dir`, filters) for hidden inputs and links.
 */
export const buildDomainTablePreserveParams = (
  params: DomainTableListParamsParsed,
): Record<string, string> => {
  const extra = buildDomainTableFilterExtraParams(params);
  if (params.sortBy) {
    extra.sort = params.sortBy;
    extra.dir = params.sortDir;
  }
  return extra;
};
