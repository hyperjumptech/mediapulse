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

export const buildListHref = (
  basePath: string,
  {
    page = 1,
    pageSize,
    search,
    sortBy,
    sortDir,
    extra = {},
  }: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortDir?: SortDirection;
    extra?: Record<string, string | undefined>;
  },
): string => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (pageSize !== undefined) {
    params.set("size", String(pageSize));
  }
  if (search) {
    params.set("q", search);
  }
  if (sortBy) {
    params.set("sort", sortBy);
  }
  if (sortDir) {
    params.set("dir", sortDir);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }

  return `${basePath}?${params.toString()}`;
};

export const nextSortDirection = (
  field: string,
  activeField: string,
  activeDirection: SortDirection,
): SortDirection =>
  field === activeField && activeDirection === "asc" ? "desc" : "asc";
