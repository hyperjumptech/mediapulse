import Link from "next/link";

import { withAuthProtection } from "@/components/with-auth-protection";
import {
  getSchedulesPage,
  type ScheduleSortDir,
  type ScheduleSortField,
} from "@/lib/schedules";

import { Pagination } from "./pagination";
import { SchedulesSearch } from "./schedules-search";
import { SchedulesTable } from "./schedules-table";
import { Button } from "@workspace/ui/components/button";

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

  const {
    schedules,
    total,
    page: currentPage,
    pageSize: size,
  } = await getSchedulesPage(page, pageSize, { search, sortBy, sortDir });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <SchedulesSearch
          initialQuery={search ?? ""}
          pageSize={size}
          sortBy={sortBy}
          sortDir={sortDir}
        />
        <div className="shrink-0 sm:ml-auto">
          <Button asChild>
            <Link href="/dashboard/schedules/new">Create schedule</Link>
          </Button>
        </div>
      </div>
      <SchedulesTable
        schedules={schedules}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={size}
        searchQuery={search}
      />
      <Pagination
        basePath="/dashboard/schedules"
        page={currentPage}
        pageSize={size}
        total={total}
        searchQuery={search}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
};

export default withAuthProtection(SchedulesPage);
