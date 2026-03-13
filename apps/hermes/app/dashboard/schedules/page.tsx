import { withAuthProtection } from "@/components/with-auth-protection";
import { getPipelinesWithSteps } from "@/lib/pipelines";
import {
  getSchedulesPage,
  type ScheduleSortDir,
  type ScheduleSortField,
} from "@/lib/schedules";
import { getPipelinesValidationMap } from "@/lib/validate-pipeline";
import { prisma } from "@workspace/database";

import { SchedulesWithModal } from "./schedules-with-modal";

const DEFAULT_PAGE_SIZE = 15;

const SORT_FIELDS: ScheduleSortField[] = [
  "name",
  "nextRunAt",
  "created",
  "enabled",
];
const SORT_DIRS: ScheduleSortDir[] = ["asc", "desc"];

const parseSort = (
  sort?: string,
  dir?: string,
): { sortBy: ScheduleSortField; sortDir: ScheduleSortDir } => {
  const sortBy = SORT_FIELDS.includes(sort as ScheduleSortField)
    ? (sort as ScheduleSortField)
    : "name";
  const sortDir = SORT_DIRS.includes(dir as ScheduleSortDir)
    ? (dir as ScheduleSortDir)
    : "asc";
  return { sortBy, sortDir };
};

/**
 * Schedules list page. Fetches paginated schedules and renders table with edit/delete row actions.
 * Supports search by name or description and sort by name, nextRunAt, created, or enabled.
 */
const SchedulesPage = async ({
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

  const [schedulesResult, pipelines] = await Promise.all([
    getSchedulesPage(page, pageSize, { search, sortBy, sortDir }),
    getPipelinesWithSteps(),
  ]);
  const pipelineValidationById = await getPipelinesValidationMap(
    pipelines,
    prisma,
  );

  const {
    schedules,
    total,
    page: currentPage,
    pageSize: size,
  } = schedulesResult;

  return (
    <SchedulesWithModal
      schedules={schedules}
      pipelines={pipelines}
      pipelineValidationById={pipelineValidationById}
      currentPage={currentPage}
      pageSize={size}
      total={total}
      searchQuery={search}
      sortBy={sortBy}
      sortDir={sortDir}
    />
  );
};

export default withAuthProtection(SchedulesPage);
