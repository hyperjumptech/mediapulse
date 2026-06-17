/**
 * Custom hook for content-generation runs filter state.
 * Encapsulates the logic for determining if any filters are active.
 *
 * @param filters - Current filter values from URL search params.
 * @param filters.outcome - Active outcome filter value.
 * @param filters.tickerId - Active tickerId filter value.
 * @param filters.startTime - Active startTime filter value.
 * @param filters.endTime - Active endTime filter value.
 * @returns Object with `hasActiveFilters` boolean.
 */
export const useContentGenerationRunsFilters = (filters: {
  outcome?: string;
  tickerId?: string;
  startTime?: string;
  endTime?: string;
}) => {
  const hasActiveFilters =
    Boolean(filters.outcome) ||
    Boolean(filters.tickerId) ||
    Boolean(filters.startTime) ||
    Boolean(filters.endTime);

  return { hasActiveFilters };
};
