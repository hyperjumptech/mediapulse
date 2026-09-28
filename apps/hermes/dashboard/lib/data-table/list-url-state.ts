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

export const buildSortHref = (state: ListUrlState, sortKey: string): string =>
  buildListHref(state.basePath, {
    pageSize: state.pageSize,
    search: state.search,
    sortBy: sortKey,
    sortDir: nextSortDirection(sortKey, state.sortBy ?? "", state.sortDir),
    extra: state.extra,
  });

export const buildClearSearchHref = (state: ListUrlState): string =>
  buildListHref(state.basePath, {
    pageSize: state.pageSize,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    extra: state.extra,
  });
