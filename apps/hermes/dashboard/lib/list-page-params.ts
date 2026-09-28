export const DEFAULT_LIST_PAGE_SIZE = 15;

const MAX_LIST_PAGE_SIZE = 100;

export type SortDirection = "asc" | "desc";

export type ListPageSearchParams = {
  page?: string;
  size?: string;
  q?: string;
  sort?: string;
  dir?: string;
};

export const parseListPagination = (
  searchParams: Pick<ListPageSearchParams, "page" | "size">,
  defaultPageSize = DEFAULT_LIST_PAGE_SIZE,
): { page: number; pageSize: number } => {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const requestedSize =
    parseInt(searchParams.size ?? String(defaultPageSize), 10) ||
    defaultPageSize;
  const pageSize = Math.min(MAX_LIST_PAGE_SIZE, Math.max(1, requestedSize));

  return { page, pageSize };
};

export const parseListSort = <Field extends string>(
  searchParams: Pick<ListPageSearchParams, "sort" | "dir">,
  fields: readonly Field[],
  defaultField: Field,
  defaultDirection: SortDirection = "asc",
): { sortBy: Field; sortDir: SortDirection } => {
  const sortBy = fields.includes(searchParams.sort as Field)
    ? (searchParams.sort as Field)
    : defaultField;
  const sortDir =
    searchParams.dir === "asc" || searchParams.dir === "desc"
      ? searchParams.dir
      : defaultDirection;

  return { sortBy, sortDir };
};

export const parseListSearch = (
  searchParams: Pick<ListPageSearchParams, "q">,
): string | undefined => {
  const trimmed = searchParams.q?.trim();

  return trimmed ? trimmed : undefined;
};
