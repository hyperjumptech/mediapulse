import type {
  DashboardView,
  ResourceTableListFilterDefinition,
  ResourceTableView,
} from "@hermes/domain-contract";

import type { DomainIntegrationRecord } from "./domain-integrations";
import { mergeDomainIntegrationNavViews } from "./merge-domain-integration-nav-pages";

export type DomainResourceTableFilterSummary = {
  key: string;
  label: string;
  ui: ResourceTableListFilterDefinition["ui"];
  queryKeys: string[];
  options?: Array<{ value: string; label: string }>;
};

export type DomainResourceTableViewSummary = {
  id: string;
  label: string;
  description?: string;
  pathSegment: string;
  columns: Array<{ key: string; label: string; format: string }>;
  searchableFields: string[];
  sortableFields: string[];
  defaultSort?: ResourceTableView["defaultSort"];
  filters: DomainResourceTableFilterSummary[];
};

const isResourceTableView = (
  view: DashboardView,
): view is DashboardView & ResourceTableView => view.kind === "resource-table";

export const listDomainResourceTableViews = (
  integration: DomainIntegrationRecord,
): ResourceTableView[] =>
  mergeDomainIntegrationNavViews(integration).filter(isResourceTableView);

export const findDomainResourceTableView = (
  integration: DomainIntegrationRecord,
  resource: string,
): ResourceTableView | undefined =>
  listDomainResourceTableViews(integration).find(
    (view) => view.pathSegment === resource,
  );

export const domainTableFilterQueryKeys = (
  filter: ResourceTableListFilterDefinition,
): string[] => {
  if (filter.ui !== "date-range") {
    return [filter.key];
  }

  const fromKey = filter.rangeParams?.from ?? "from";
  const toKey = filter.rangeParams?.to ?? "to";

  return [fromKey, toKey];
};

const toFilterSummary = (
  filter: ResourceTableListFilterDefinition,
): DomainResourceTableFilterSummary => {
  const summary: DomainResourceTableFilterSummary = {
    key: filter.key,
    label: filter.label,
    ui: filter.ui,
    queryKeys: domainTableFilterQueryKeys(filter),
  };
  if (filter.staticOptions) {
    summary.options = filter.staticOptions;
  }

  return summary;
};

export const toDomainResourceTableViewSummary = (
  view: ResourceTableView,
): DomainResourceTableViewSummary => {
  const columns = view.columns.map((column) => ({
    key: column.key,
    label: column.label,
    format: column.format ?? column.type,
  }));
  const filters = (view.listFilters ?? []).map(toFilterSummary);

  return {
    id: view.id,
    label: view.label,
    description: view.description,
    pathSegment: view.pathSegment,
    columns,
    searchableFields: view.searchableFields,
    sortableFields: view.sortableFields,
    defaultSort: view.defaultSort,
    filters,
  };
};
