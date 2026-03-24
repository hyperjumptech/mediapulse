import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import { getPipelinesWithSteps } from "@/lib/pipelines";
import {
  getHttpTriggersPage,
  type HttpTriggerSortDir,
  type HttpTriggerSortField,
} from "@/lib/http-triggers";

import { HttpTriggersWithModal } from "./http-triggers-with-modal";

const DEFAULT_PAGE_SIZE = 15;
const SORT_FIELDS: HttpTriggerSortField[] = [
  "name",
  "method",
  "created",
  "enabled",
];
const SORT_DIRS: HttpTriggerSortDir[] = ["asc", "desc"];

const parseSort = (
  sort?: string,
  dir?: string,
): { sortBy: HttpTriggerSortField; sortDir: HttpTriggerSortDir } => {
  const sortBy = SORT_FIELDS.includes(sort as HttpTriggerSortField)
    ? (sort as HttpTriggerSortField)
    : "name";
  const sortDir = SORT_DIRS.includes(dir as HttpTriggerSortDir)
    ? (dir as HttpTriggerSortDir)
    : "asc";
  return { sortBy, sortDir };
};

/**
 * HTTP triggers list page.
 */
const HttpTriggersPage = async ({
  searchParams,
}: {
  searchParams:
    | Promise<{
        page?: string;
        size?: string;
        q?: string;
        sort?: string;
        dir?: string;
      }>
    | { page?: string; size?: string; q?: string; sort?: string; dir?: string };
}) => {
  const resolved = await Promise.resolve(searchParams);
  const page = Math.max(1, parseInt(resolved.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      parseInt(resolved.size ?? String(DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE,
    ),
  );
  const search = resolved.q?.trim() ?? undefined;
  const { sortBy, sortDir } = parseSort(resolved.sort, resolved.dir);
  const [triggersResult, pipelines] = await Promise.all([
    getHttpTriggersPage(page, pageSize, { search, sortBy, sortDir }),
    getPipelinesWithSteps(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="HTTP Triggers"
        description="Run pipelines on demand through authenticated HTTP endpoints."
      />
      <HttpTriggersWithModal
        httpTriggers={triggersResult.httpTriggers}
        pipelines={pipelines}
        currentPage={triggersResult.page}
        pageSize={triggersResult.pageSize}
        total={triggersResult.total}
        searchQuery={search}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
};

export default withAuthProtection(HttpTriggersPage);
