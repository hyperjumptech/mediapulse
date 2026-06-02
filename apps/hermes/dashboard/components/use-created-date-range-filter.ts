/**
 * Encapsulates whether any created-date range filter values are active.
 *
 * @param filters - Current `from` / `to` values from URL search params.
 * @returns Object with `hasActiveFilters` when either bound is set.
 */
export const useCreatedDateRangeFilter = (filters: {
  from?: string;
  to?: string;
}) => {
  const hasActiveFilters = Boolean(filters.from) || Boolean(filters.to);
  return { hasActiveFilters };
};
