import {
  parseListSearch,
  parseListSort,
  type SortDirection,
} from "./list-page-params";

export const DEFAULT_API_PAGE_SIZE = 20;

export const MAX_API_PAGE_SIZE = 100;

export type ApiPageParams = {
  page: number;
  pageSize: number;
};

export type ApiListQuery = ApiPageParams & {
  search: string | undefined;
  sort: string | undefined;
  dir: SortDirection | undefined;
};

export type ApiListParams<Field extends string> = ApiPageParams & {
  search: string | undefined;
  sortBy: Field;
  sortDir: SortDirection;
};

export type ApiListSortOptions<Field extends string> = {
  fields: readonly Field[];
  defaultField: Field;
  defaultDirection?: SortDirection;
};

const readApiPageParams = (
  searchParams: URLSearchParams,
  defaults?: Partial<ApiPageParams>,
): ApiPageParams => {
  const defaultPage = defaults?.page ?? 1;
  const defaultPageSize = defaults?.pageSize ?? DEFAULT_API_PAGE_SIZE;
  const pageRaw = searchParams.get("page");
  const pageSizeRaw = searchParams.get("pageSize");
  const page = Math.max(
    1,
    parseInt(pageRaw ?? String(defaultPage), 10) || defaultPage,
  );
  const requestedPageSize =
    parseInt(pageSizeRaw ?? String(defaultPageSize), 10) || defaultPageSize;
  const pageSize = Math.min(MAX_API_PAGE_SIZE, Math.max(1, requestedPageSize));

  return { page, pageSize };
};

const readSortDirection = (value: string | null): SortDirection | undefined =>
  value === "asc" || value === "desc" ? value : undefined;

export const parseApiPageParams = (
  request: Request,
  defaults?: Partial<ApiPageParams>,
): ApiPageParams =>
  readApiPageParams(new URL(request.url).searchParams, defaults);

export const parseApiListQuery = (request: Request): ApiListQuery => {
  const searchParams = new URL(request.url).searchParams;
  const search = parseListSearch({ q: searchParams.get("q") ?? undefined });
  const sort = searchParams.get("sort")?.trim() || undefined;
  const dir = readSortDirection(searchParams.get("dir"));

  return { ...readApiPageParams(searchParams), search, sort, dir };
};

export const parseApiListParams = <Field extends string>(
  request: Request,
  { fields, defaultField, defaultDirection = "asc" }: ApiListSortOptions<Field>,
): ApiListParams<Field> => {
  const { page, pageSize, search, sort, dir } = parseApiListQuery(request);
  const { sortBy, sortDir } = parseListSort(
    { sort, dir },
    fields,
    defaultField,
    defaultDirection,
  );

  return { page, pageSize, search, sortBy, sortDir };
};
