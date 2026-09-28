import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { CircleAlert } from "lucide-react";

import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import {
  fetchProcessedUrlsForExecution,
  type FetchProcessedUrlsParams,
  type ProcessedUrlsListResponse,
} from "@/lib/domain-dashboard";
import { parseListPagination } from "@/lib/list-page-params";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import {
  ProcessedUrlsFilters,
  type ProcessedUrlFilterGroup,
} from "./processed-urls-filters";
import { ProcessedUrlsTable } from "./processed-urls-table";

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

const PROCESSED_URLS_TABLE_ID = "processed-urls";

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
  pageSize: number,
): string => {
  const searchParams = new URLSearchParams();
  const size = pageSize === PAGE_SIZE ? undefined : String(pageSize);
  const merged = { ...filters, page: "1", size, ...updates };
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
  pageSize: number,
): ProcessedUrlFilterGroup[] =>
  FILTER_DEFINITIONS.map((definition) => {
    const activeValue = filters[definition.key] ?? "";
    const options = definition.values.map((value) => {
      const update = { [definition.key]: value || undefined };

      return {
        label: value || "All",
        href: buildFilterHref(basePath, filters, update, pageSize),
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

  const { page, pageSize } = parseListPagination(
    {
      page: firstValue(resolvedSearchParams.page),
      size: firstValue(resolvedSearchParams.size),
    },
    PAGE_SIZE,
  );
  const filters: ProcessedUrlFilters = {
    tickerId: firstValue(resolvedSearchParams.tickerId),
    agent: firstValue(resolvedSearchParams.agent),
    status: firstValue(resolvedSearchParams.status),
    gateStatus: firstValue(resolvedSearchParams.gateStatus),
  };

  const [{ data, fetchError }, savedVisibility] = await Promise.all([
    withDashboardAdmin(
      loadProcessedUrls({
        scheduleExecutionId: executionId,
        page,
        pageSize,
        ...filters,
      }),
    ),
    readColumnVisibility(PROCESSED_URLS_TABLE_ID),
  ]);

  const basePath = `/dashboard/schedules/${scheduleId}/executions/${executionId}/processed-urls`;
  const filterGroups = buildFilterGroups(basePath, filters, pageSize);
  const filterControls = <ProcessedUrlsFilters groups={filterGroups} />;
  const hasActiveFilters = Object.values(filters).some(Boolean);

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        {filterControls}
        {fetchError ? <ProcessedUrlsLoadError message={fetchError} /> : null}
      </div>
    );
  }

  return (
    <ProcessedUrlsTable
      tableId={PROCESSED_URLS_TABLE_ID}
      items={data.items}
      urlState={{
        basePath,
        page: data.page,
        pageSize: data.pageSize,
        total: data.total,
        sortDir: "desc",
        extra: toPaginationParams(filters),
      }}
      filters={filterControls}
      hasActiveFilters={hasActiveFilters}
      clearFiltersHref={basePath}
      initialColumnVisibility={savedVisibility}
    />
  );
}
