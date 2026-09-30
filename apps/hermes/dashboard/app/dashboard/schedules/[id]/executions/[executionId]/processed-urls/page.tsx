import { notFound } from "next/navigation";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { CircleAlert } from "lucide-react";

import { mergeColumnVisibility } from "@/lib/data-table/column-visibility";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import {
  fetchProcessedUrlsForExecution,
  type FetchProcessedUrlsParams,
  type ProcessedUrlsListResponse,
} from "@/lib/domain-dashboard";
import { parseListPagination } from "@/lib/list-page-params";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { loadProcessedUrlsExecution } from "@/lib/processed-urls-execution";
import {
  ProcessedUrlsFilters,
  type ProcessedUrlFilterGroup,
} from "./processed-urls-filters";
import { ProcessedUrlsTable } from "./processed-urls-table";
import {
  PROCESSED_URLS_DEFAULT_COLUMN_VISIBILITY,
  PROCESSED_URLS_TABLE_ID,
} from "./processed-urls-table-defaults";

type PageProps = {
  params: Promise<{ id: string; executionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ProcessedUrlFilterKey = "agent" | "status" | "gateStatus";

type ProcessedUrlFilters = {
  subjectId?: string;
  agent?: string;
  status?: string;
  gateStatus?: string;
};

type ProcessedUrlFilterDefinition = {
  key: ProcessedUrlFilterKey;
  label: string;
  values: readonly string[];
};

type ProcessedUrlsPageData = {
  agentIds: string[];
  data: ProcessedUrlsListResponse | null;
  fetchError: string | null;
};

const PAGE_SIZE = 50;

const OUTCOME_FILTER_DEFINITIONS: readonly ProcessedUrlFilterDefinition[] = [
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

const buildFilterDefinitions = (
  agentIds: string[],
): ProcessedUrlFilterDefinition[] => {
  if (agentIds.length === 0) {
    return [...OUTCOME_FILTER_DEFINITIONS];
  }

  const agentFilterDefinition: ProcessedUrlFilterDefinition = {
    key: "agent",
    label: "Agent",
    values: ["", ...agentIds],
  };

  return [agentFilterDefinition, ...OUTCOME_FILTER_DEFINITIONS];
};

const loadProcessedUrls = async (
  query: FetchProcessedUrlsParams,
): Promise<Omit<ProcessedUrlsPageData, "agentIds">> => {
  try {
    const data = await fetchProcessedUrlsForExecution(query);

    return { data, fetchError: null };
  } catch (error) {
    const fetchError =
      error instanceof Error ? error.message : "Failed to load processed URLs";

    return { data: null, fetchError };
  }
};

const loadProcessedUrlsPageData = async (
  scheduleId: string,
  query: Omit<FetchProcessedUrlsParams, "integrationId">,
): Promise<ProcessedUrlsPageData | null> => {
  const execution = await loadProcessedUrlsExecution(
    scheduleId,
    query.scheduleExecutionId,
  );
  if (!execution) {
    return null;
  }

  const result = await loadProcessedUrls({
    ...query,
    integrationId: execution.integrationId,
  });

  return { agentIds: execution.agentIds, ...result };
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
  definitions: ProcessedUrlFilterDefinition[],
): ProcessedUrlFilterGroup[] =>
  definitions.map((definition) => {
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
    subjectId: firstValue(resolvedSearchParams.subjectId),
    agent: firstValue(resolvedSearchParams.agent),
    status: firstValue(resolvedSearchParams.status),
    gateStatus: firstValue(resolvedSearchParams.gateStatus),
  };

  const [pageData, savedVisibility] = await Promise.all([
    withDashboardAdmin(
      loadProcessedUrlsPageData(scheduleId, {
        scheduleExecutionId: executionId,
        page,
        pageSize,
        ...filters,
      }),
    ),
    readColumnVisibility(PROCESSED_URLS_TABLE_ID),
  ]);
  if (!pageData) {
    notFound();
  }

  const { agentIds, data, fetchError } = pageData;
  const basePath = `/dashboard/schedules/${scheduleId}/executions/${executionId}/processed-urls`;
  const filterDefinitions = buildFilterDefinitions(agentIds);
  const filterGroups = buildFilterGroups(
    basePath,
    filters,
    pageSize,
    filterDefinitions,
  );
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
      subjectTitle={data.subjectTitle}
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
      initialColumnVisibility={mergeColumnVisibility(
        PROCESSED_URLS_DEFAULT_COLUMN_VISIBILITY,
        savedVisibility,
      )}
    />
  );
}
