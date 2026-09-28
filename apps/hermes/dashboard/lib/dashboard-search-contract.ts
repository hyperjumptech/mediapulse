export const DASHBOARD_SEARCH_MINIMUM_QUERY_LENGTH = 2;

export const DASHBOARD_SEARCH_MAXIMUM_QUERY_LENGTH = 100;

export type DashboardSearchResultType =
  | "pipeline"
  | "schedule"
  | "httpTrigger"
  | "agent"
  | "agentConfig"
  | "variable";

export type DashboardSearchResult = {
  type: DashboardSearchResultType;
  id: string;
  label: string;
  description?: string;
  href: string;
};

export type DashboardSearchResponse = {
  results: DashboardSearchResult[];
};
