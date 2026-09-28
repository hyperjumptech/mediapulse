import {
  buildListHref,
  nextSortDirection,
  type SortDirection,
} from "@/lib/list-page-params";

export type ListUrlState = {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  search?: string;
  sortBy?: string;
  sortDir: SortDirection;
  extra?: Record<string, string>;
};

export const buildSortHref = (
  state: ListUrlState,
  sortKey: string,
  direction: SortDirection = nextSortDirection(
    sortKey,
    state.sortBy ?? "",
    state.sortDir,
  ),
): string =>
  buildListHref(state.basePath, {
    pageSize: state.pageSize,
    search: state.search,
    sortBy: sortKey,
    sortDir: direction,
    extra: state.extra,
  });

export const buildSearchHref = (state: ListUrlState, search: string): string =>
  buildListHref(state.basePath, {
    pageSize: state.pageSize,
    search: search || undefined,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    extra: state.extra,
  });

export const buildClearSearchHref = (state: ListUrlState): string =>
  buildSearchHref(state, "");
