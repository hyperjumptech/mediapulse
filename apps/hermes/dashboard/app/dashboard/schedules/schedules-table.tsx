"use client";

import Link from "next/link";
import { CalendarClock, Plus, SearchX } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { DataTableCard } from "@/components/data-table/data-table-card";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { DateTime } from "@/components/date-time/date-time";
import { StatusBadge } from "@/components/status-badge";
import { formatCreatedBy } from "@/lib/format-created-by";
import { buildListHref, nextSortDirection } from "@/lib/list-page-params";
import type {
  ScheduleSortDir,
  ScheduleSortField,
  SchedulesPageResult,
} from "@/lib/schedules";

import { describeScheduleCadence } from "./describe-schedule-cadence";
import { ScheduleRowActions } from "./schedule-row-actions";

type ScheduleRow = SchedulesPageResult["schedules"][number];

type EditScheduleHandler = (scheduleId: string) => void;

type CreateScheduleHandler = () => void;

const BASE_PATH = "/dashboard/schedules";

type SchedulesTableProps = {
  schedules: ScheduleRow[];
  sortBy: ScheduleSortField;
  sortDir: ScheduleSortDir;
  pageSize: number;
  searchQuery?: string;
  onEdit: EditScheduleHandler;
  onCreate: CreateScheduleHandler;
};

const SchedulesEmptyState = ({
  searchQuery,
  clearSearchHref,
  onCreate,
}: {
  searchQuery?: string;
  clearSearchHref: string;
  onCreate: CreateScheduleHandler;
}) => {
  if (searchQuery) {
    return (
      <Empty className="gap-4 py-12 md:py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX aria-hidden className="size-5 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle className="text-base">
            No schedules match “{searchQuery}”
          </EmptyTitle>
          <EmptyDescription>
            Try a different schedule name or description.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" asChild>
            <Link href={clearSearchHref}>Clear search</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="gap-4 py-12 md:py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarClock aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base">No schedules yet</EmptyTitle>
        <EmptyDescription>
          Schedules run a pipeline automatically on a cron expression or a fixed
          interval.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" size="sm" onClick={onCreate}>
          <Plus aria-hidden />
          New schedule
        </Button>
      </EmptyContent>
    </Empty>
  );
};

const ScheduleCadenceLabel = ({ schedule }: { schedule: ScheduleRow }) => {
  const cadence = describeScheduleCadence(schedule);

  if (cadence.isCronExpression) {
    return (
      <code
        className="font-mono text-xs"
        title={`Cron in ${schedule.timezone}`}
      >
        {cadence.label}
      </code>
    );
  }

  return <span>{cadence.label}</span>;
};

export const SchedulesTable = ({
  schedules,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
  onEdit,
  onCreate,
}: SchedulesTableProps) => {
  const clearSearchHref = buildListHref(BASE_PATH, {
    pageSize,
    sortBy,
    sortDir,
  });

  const sortHeader = (field: ScheduleSortField, label: string) => {
    const direction = nextSortDirection(field, sortBy, sortDir);
    const href = buildListHref(BASE_PATH, {
      pageSize,
      search: searchQuery,
      sortBy: field,
      sortDir: direction,
    });

    return (
      <SortableHeader
        label={label}
        href={href}
        isActive={sortBy === field}
        direction={sortDir}
      />
    );
  };

  if (schedules.length === 0) {
    return (
      <DataTableCard>
        <SchedulesEmptyState
          searchQuery={searchQuery}
          clearSearchHref={clearSearchHref}
          onCreate={onCreate}
        />
      </DataTableCard>
    );
  }

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">{sortHeader("name", "Name")}</TableHead>
            <TableHead>Pipeline</TableHead>
            <TableHead>Repeats</TableHead>
            <TableHead>{sortHeader("nextRunAt", "Next run")}</TableHead>
            <TableHead>{sortHeader("enabled", "Status")}</TableHead>
            <TableHead className="hidden sm:table-cell">
              {sortHeader("created", "Created")}
            </TableHead>
            <TableHead className="hidden md:table-cell">Created by</TableHead>
            <TableHead className="w-12 pr-2">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.map((schedule) => {
            const scheduleHref = `${BASE_PATH}/${schedule.id}`;
            const pipelineHref = `/dashboard/pipelines/${schedule.pipeline.id}`;
            const enabledStatus = schedule.enabled ? "enabled" : "disabled";
            const createdBy = formatCreatedBy(
              schedule.createdBy,
              schedule.createdById,
            );

            return (
              <TableRow key={schedule.id}>
                <TableCell className="pl-4">
                  <Link
                    href={scheduleHref}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {schedule.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <Link
                    href={pipelineHref}
                    className="underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {schedule.pipeline.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <ScheduleCadenceLabel schedule={schedule} />
                </TableCell>
                <TableCell>
                  {schedule.nextRunAt ? (
                    <DateTime value={schedule.nextRunAt} variant="both" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={enabledStatus} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  <DateTime value={schedule.createdAt} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {createdBy}
                </TableCell>
                <TableCell className="pr-2 text-right">
                  <ScheduleRowActions
                    scheduleId={schedule.id}
                    scheduleName={schedule.name}
                    onEdit={onEdit}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DataTableCard>
  );
};
