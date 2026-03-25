"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { ScheduleRowActions } from "./schedule-row-actions";
import type {
  ScheduleSortDir,
  ScheduleSortField,
  SchedulesPageResult,
} from "@/lib/schedules";
import { formatCreatedBy } from "@/lib/format-created-by";

type ScheduleRow = SchedulesPageResult["schedules"][number];

const BASE_PATH = "/dashboard/schedules";

/**
 * Builds schedules list URL with sort (resets to page 1 when sort changes).
 */
const buildSortHref = (
  sortBy: ScheduleSortField,
  sortDir: ScheduleSortDir,
  pageSize: number,
  searchQuery?: string,
): string => {
  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("size", String(pageSize));
  if (searchQuery) params.set("q", searchQuery);
  params.set("sort", sortBy);
  params.set("dir", sortDir);
  return `${BASE_PATH}?${params.toString()}`;
};

type SchedulesTableProps = {
  schedules: ScheduleRow[];
  sortBy: ScheduleSortField;
  sortDir: ScheduleSortDir;
  pageSize: number;
  searchQuery?: string;
  onEdit: (scheduleId: string) => void;
};

/**
 * Renders the schedules list as a table with sortable columns and row actions (Edit, Delete).
 */
export const SchedulesTable = ({
  schedules,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
  onEdit,
}: SchedulesTableProps) => {
  const sortLink = (field: ScheduleSortField, label: string) => {
    const isActive = sortBy === field;
    const nextDir: ScheduleSortDir =
      isActive && sortDir === "asc" ? "desc" : "asc";
    const href = buildSortHref(
      field,
      isActive ? nextDir : "asc",
      pageSize,
      searchQuery,
    );
    const Icon = isActive
      ? sortDir === "asc"
        ? ArrowUp
        : ArrowDown
      : ArrowUpDown;

    return (
      <Link
        href={href}
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
        aria-sort={
          isActive
            ? sortDir === "asc"
              ? "ascending"
              : "descending"
            : undefined
        }
      >
        {label}
        <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
      </Link>
    );
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-muted hover:bg-transparent">
            <TableHead className="w-[180px]">
              {sortLink("name", "Name")}
            </TableHead>
            <TableHead className="w-[140px]">Pipeline</TableHead>
            <TableHead className="w-[100px]">Repeat</TableHead>
            <TableHead>{sortLink("nextRunAt", "Next run")}</TableHead>
            <TableHead className="w-[80px]">
              {sortLink("enabled", "Enabled")}
            </TableHead>
            <TableHead className="w-[120px]">
              {sortLink("created", "Created")}
            </TableHead>
            <TableHead className="w-[180px]">Created by</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-center text-muted-foreground"
              >
                No schedules yet.
              </TableCell>
            </TableRow>
          ) : (
            schedules.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/schedules/${schedule.id}`}
                    className="underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground hover:text-foreground"
                  >
                    {schedule.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {schedule.pipeline.name}
                </TableCell>
                <TableCell className="text-sm capitalize">
                  {schedule.repeat}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {schedule.nextRunAt
                    ? format(schedule.nextRunAt, "LLL d, yyyy HH:mm")
                    : "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {schedule.enabled ? "Yes" : "No"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(schedule.createdAt, "LLL d, yyyy")}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatCreatedBy(schedule.createdBy, schedule.createdById)}
                </TableCell>
                <TableCell className="text-right">
                  <ScheduleRowActions
                    scheduleId={schedule.id}
                    scheduleName={schedule.name}
                    onEdit={onEdit}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
