import type {
  TableV1ListFilterDefinition,
  TableV1MetaResponse,
} from "@hermes/domain-contract";

export type DomainTableSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type DomainTableListParamsParsed = {
  page: number;
  pageSize: number;
  query?: string;
  sortBy?: string;
  sortDir: "asc" | "desc";
  /** Parsed filter query params keyed by URL param name. */
  filters: Record<string, string>;
};

/**
 * Returns the first string value from a Next.js search param that may be duplicated.
 *
 * @param value - Raw search param value (`string`, `string[]`, or undefined).
 * @returns The first non-array string, or `undefined` when empty.
 */
export const firstSearchParamValue = (
  value: string | string[] | undefined,
): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

/**
 * Extracts active filter query param values from route search params using manifest definitions.
 *
 * @param searchParams - Route search params.
 * @param listFilters - Manifest filter definitions from table-v1 meta.
 * @returns Non-empty filter entries keyed by query param name.
 */
export const parseDomainTableFilterValues = (
  searchParams: DomainTableSearchParams,
  listFilters: TableV1ListFilterDefinition[],
): Record<string, string> => {
  const filters: Record<string, string> = {};

  for (const filter of listFilters) {
    if (filter.ui === "date-range") {
      const fromKey = filter.rangeParams?.from ?? "from";
      const toKey = filter.rangeParams?.to ?? "to";
      const from = firstSearchParamValue(searchParams[fromKey])?.trim();
      const to = firstSearchParamValue(searchParams[toKey])?.trim();
      if (from) filters[fromKey] = from;
      if (to) filters[toKey] = to;
      continue;
    }

    const value = firstSearchParamValue(searchParams[filter.key])?.trim();
    if (value) {
      filters[filter.key] = value;
    }
  }

  return filters;
};

/**
 * Builds filter query params to preserve in pagination, search, and sort links.
 *
 * @param filters - Parsed filter values keyed by query param name.
 * @returns Record of non-empty filter entries.
 */
export const buildDomainTableFilterExtraParams = (
  filters: Record<string, string>,
): Record<string, string> => {
  const extra: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value) extra[key] = value;
  }
  return extra;
};

/**
 * Parses route search params into pagination, search, and filter values.
 *
 * @param searchParams - Route search params.
 * @param listFilters - Manifest filter definitions used to parse filter params.
 * @returns Parsed pagination and filter values (sort resolved separately via meta).
 */
export const parseDomainTableSearchParams = (
  searchParams: DomainTableSearchParams,
  listFilters: TableV1ListFilterDefinition[] = [],
): Omit<DomainTableListParamsParsed, "sortBy" | "sortDir"> => {
  const page = Math.max(
    1,
    Number.parseInt(firstSearchParamValue(searchParams.page) ?? "1", 10) || 1,
  );
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      Number.parseInt(firstSearchParamValue(searchParams.size) ?? "15", 10) ||
        15,
    ),
  );
  const query = firstSearchParamValue(searchParams.q)?.trim() || undefined;

  return {
    page,
    pageSize,
    query,
    filters: parseDomainTableFilterValues(searchParams, listFilters),
  };
};

/**
 * Resolves list sort from URL params or manifest `defaultSort`.
 *
 * @param searchParams - Route search params (`sort`, `dir`).
 * @param meta - Table meta with `sortableFields` and optional `defaultSort`.
 * @returns `sortBy` and `sortDir` for the domain list API.
 */
export const resolveDomainTableListSort = (
  searchParams: DomainTableSearchParams,
  meta: Pick<TableV1MetaResponse, "sortableFields" | "defaultSort">,
): { sortBy?: string; sortDir: "asc" | "desc" } => {
  const urlSort = firstSearchParamValue(searchParams.sort)?.trim();
  if (urlSort && meta.sortableFields.includes(urlSort)) {
    return {
      sortBy: urlSort,
      sortDir:
        firstSearchParamValue(searchParams.dir) === "asc" ? "asc" : "desc",
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
 * @param meta - Table meta used to resolve default sort and filter definitions.
 * @returns Full list params for `getDomainTableList`.
 */
export const buildDomainTableListParams = (
  searchParams: DomainTableSearchParams,
  meta: Pick<
    TableV1MetaResponse,
    "sortableFields" | "defaultSort" | "listFilters"
  >,
): DomainTableListParamsParsed => {
  const base = parseDomainTableSearchParams(
    searchParams,
    meta.listFilters ?? [],
  );
  const sort = resolveDomainTableListSort(searchParams, meta);
  return { ...base, ...sort };
};

/**
 * Query params to preserve across search, sort, and pagination links.
 *
 * Includes active filter keys so those controls keep filters in the URL.
 * Do not pass this map into the filter form — use
 * {@link buildDomainTableFilterFormPreserveParams} instead.
 *
 * @param params - Parsed list params including resolved sort.
 * @returns URL query keys (`sort`, `dir`, filters) for links.
 */
export const buildDomainTablePreserveParams = (
  params: DomainTableListParamsParsed,
): Record<string, string> => {
  const extra = buildDomainTableFilterExtraParams(params.filters);
  if (params.sortBy) {
    extra.sort = params.sortBy;
    extra.dir = params.sortDir;
  }
  return extra;
};

/**
 * Query params the filter GET form should preserve as hidden inputs.
 *
 * Excludes filter keys (and date-range `from`/`to`) because the form already
 * renders visible controls for those names. Including them causes duplicate
 * query params on submit and can crash server parsing.
 *
 * @param params - Parsed list params including resolved sort and search.
 * @returns URL query keys (`sort`, `dir`, `q`) owned by other list controls.
 */
export const buildDomainTableFilterFormPreserveParams = (
  params: DomainTableListParamsParsed,
): Record<string, string> => {
  const extra: Record<string, string> = {};
  if (params.sortBy) {
    extra.sort = params.sortBy;
    extra.dir = params.sortDir;
  }
  if (params.query) {
    extra.q = params.query;
  }
  return extra;
};

/**
 * Returns whether any filter values are active for the given manifest definitions.
 *
 * @param filters - Parsed filter query param values.
 * @returns True when at least one filter value is set.
 */
export const hasActiveDomainTableFilters = (
  filters: Record<string, string>,
): boolean => Object.keys(filters).length > 0;
