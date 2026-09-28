import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { CircleAlert } from "lucide-react";

import { DataTableCard } from "@/components/data-table/data-table-card";
import { ListPagination } from "@/components/list-pagination";
import {
  fetchProcessedUrlsForExecution,
  type FetchProcessedUrlsParams,
  type ProcessedUrlsListResponse,
} from "@/lib/domain-dashboard";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import {
  ProcessedUrlsEmptyState,
  ProcessedUrlsFilters,
  ProcessedUrlsTable,
  type ProcessedUrlFilterGroup,
} from "./processed-urls-sections";

type PageProps = {
  params: Promise<{ id: string; executionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ProcessedUrlFilterKey = "agent" | "status" | "gateStatus";

type ProcessedUrlFilters = {
  tickerId?: string;
  agent?: string;
  status?: string;
  gateStatus?: string;
};

const PAGE_SIZE = 50;

const FILTER_DEFINITIONS: ReadonlyArray<{
  key: ProcessedUrlFilterKey;
  label: string;
  values: readonly string[];
}> = [
  {
    key: "agent",
    label: "Agent",
    values: ["", "data-collection", "page-collection"],
  },
  {
    key: "status",
    label: "Status",
    values: ["", "collected", "dropped", "failed"],
  },
  { key: "gateStatus", label: "Gate", values: ["", "passed", "failed"] },
];

const firstValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

const loadProcessedUrls = async (
  query: FetchProcessedUrlsParams,
): Promise<{
  data: ProcessedUrlsListResponse | null;
  fetchError: string | null;
}> => {
  try {
    const data = await fetchProcessedUrlsForExecution(query);

    return { data, fetchError: null };
  } catch (error) {
    const fetchError =
      error instanceof Error ? error.message : "Failed to load processed URLs";

    return { data: null, fetchError };
  }
};

const buildFilterHref = (
  basePath: string,
  filters: ProcessedUrlFilters,
  updates: ProcessedUrlFilters,
): string => {
  const searchParams = new URLSearchParams();
  const merged = { ...filters, page: "1", ...updates };
  for (const [key, value] of Object.entries(merged)) {
    if (value) {
      searchParams.set(key, value);
    }
  }
  const queryString = searchParams.toString();

  return queryString ? `${basePath}?${queryString}` : basePath;
};

const buildFilterGroups = (
  basePath: string,
  filters: ProcessedUrlFilters,
): ProcessedUrlFilterGroup[] =>
  FILTER_DEFINITIONS.map((definition) => {
    const activeValue = filters[definition.key] ?? "";
    const options = definition.values.map((value) => {
      const update = { [definition.key]: value || undefined };

      return {
        label: value || "All",
        href: buildFilterHref(basePath, filters, update),
        isActive: activeValue === value,
      };
    });

    return { key: definition.key, label: definition.label, options };
  });

const toPaginationParams = (
  filters: ProcessedUrlFilters,
): Record<string, string> => {
  const paginationParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      paginationParams[key] = value;
    }
  }

  return paginationParams;
};

const ProcessedUrlsLoadError = ({ message }: { message: string }) => {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertTitle>Could not load processed URLs</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
};

export default async function ProcessedUrlsPage({
  params,
  searchParams,
}: PageProps) {
  const { id: scheduleId, executionId } = await params;
  const resolvedSearchParams = await searchParams;

  const requestedPage = firstValue(resolvedSearchParams.page) ?? "1";
  const page = Math.max(1, Number.parseInt(requestedPage, 10) || 1);
  const filters: ProcessedUrlFilters = {
    tickerId: firstValue(resolvedSearchParams.tickerId),
    agent: firstValue(resolvedSearchParams.agent),
    status: firstValue(resolvedSearchParams.status),
    gateStatus: firstValue(resolvedSearchParams.gateStatus),
  };

  const { data, fetchError } = await withDashboardAdmin(
    loadProcessedUrls({
      scheduleExecutionId: executionId,
      page,
      pageSize: PAGE_SIZE,
      ...filters,
    }),
  );

  const basePath = `/dashboard/schedules/${scheduleId}/executions/${executionId}/processed-urls`;
  const filterGroups = buildFilterGroups(basePath, filters);
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const paginationParams = toPaginationParams(filters);
  const isEmpty = data != null && data.total === 0;

  return (
    <div className="flex flex-col gap-6">
      <ProcessedUrlsFilters groups={filterGroups} />
      {fetchError ? <ProcessedUrlsLoadError message={fetchError} /> : null}
      {isEmpty ? (
        <DataTableCard>
          <ProcessedUrlsEmptyState
            hasActiveFilters={hasActiveFilters}
            clearFiltersHref={basePath}
          />
        </DataTableCard>
      ) : null}
      {data && !isEmpty ? (
        <div className="flex flex-col gap-4">
          <DataTableCard>
            <ProcessedUrlsTable items={data.items} />
          </DataTableCard>
          <ListPagination
            basePath={basePath}
            page={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            ariaLabel="Processed URLs pagination"
            extraParams={paginationParams}
          />
        </div>
      ) : null}
    </div>
  );
}
