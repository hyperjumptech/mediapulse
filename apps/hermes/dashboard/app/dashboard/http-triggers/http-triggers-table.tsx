"use client";

import Link from "next/link";
import { Plus, SearchX, Webhook } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
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
import type {
  HttpTriggerSortDir,
  HttpTriggerSortField,
  HttpTriggersPageResult,
} from "@/lib/http-triggers";
import { buildListHref, nextSortDirection } from "@/lib/list-page-params";

import { HttpTriggerRowActions } from "./http-trigger-row-actions";

type HttpTriggerRow = HttpTriggersPageResult["httpTriggers"][number];

type EditHttpTriggerHandler = (httpTriggerId: string) => void;

type CreateHttpTriggerHandler = () => void;

const BASE_PATH = "/dashboard/http-triggers";

type HttpTriggersTableProps = {
  httpTriggers: HttpTriggerRow[];
  sortBy: HttpTriggerSortField;
  sortDir: HttpTriggerSortDir;
  pageSize: number;
  searchQuery?: string;
  onEdit: EditHttpTriggerHandler;
  onCreate: CreateHttpTriggerHandler;
};

const HttpTriggersEmptyState = ({
  searchQuery,
  clearSearchHref,
  onCreate,
}: {
  searchQuery?: string;
  clearSearchHref: string;
  onCreate: CreateHttpTriggerHandler;
}) => {
  if (searchQuery) {
    return (
      <Empty className="gap-4 py-12 md:py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX aria-hidden className="size-5 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle className="text-base">
            No HTTP triggers match “{searchQuery}”
          </EmptyTitle>
          <EmptyDescription>
            Try a different trigger name or description.
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
          <Webhook aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base">No HTTP triggers yet</EmptyTitle>
        <EmptyDescription>
          HTTP triggers give a pipeline an authenticated endpoint that other
          systems can call to start a run.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" variant="outline" size="sm" onClick={onCreate}>
          <Plus aria-hidden />
          New HTTP trigger
        </Button>
      </EmptyContent>
    </Empty>
  );
};

export const HttpTriggersTable = ({
  httpTriggers,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
  onEdit,
  onCreate,
}: HttpTriggersTableProps) => {
  const clearSearchHref = buildListHref(BASE_PATH, {
    pageSize,
    sortBy,
    sortDir,
  });

  const sortHeader = (field: HttpTriggerSortField, label: string) => {
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

  if (httpTriggers.length === 0) {
    return (
      <DataTableCard>
        <HttpTriggersEmptyState
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
            <TableHead>{sortHeader("method", "Method")}</TableHead>
            <TableHead>{sortHeader("enabled", "Status")}</TableHead>
            <TableHead>Last triggered</TableHead>
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
          {httpTriggers.map((trigger) => {
            const triggerHref = `${BASE_PATH}/${trigger.id}`;
            const pipelineHref = `/dashboard/pipelines/${trigger.pipeline.id}`;
            const enabledStatus = trigger.enabled ? "enabled" : "disabled";
            const createdBy = formatCreatedBy(
              trigger.createdBy,
              trigger.createdById,
            );

            return (
              <TableRow key={trigger.id}>
                <TableCell className="pl-4">
                  <Link
                    href={triggerHref}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {trigger.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <Link
                    href={pipelineHref}
                    className="underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {trigger.pipeline.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="px-1.5 font-mono text-muted-foreground"
                  >
                    {trigger.method}
                  </Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={enabledStatus} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {trigger.lastTriggeredAt ? (
                    <DateTime value={trigger.lastTriggeredAt} variant="both" />
                  ) : (
                    "Never"
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  <DateTime value={trigger.createdAt} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {createdBy}
                </TableCell>
                <TableCell className="pr-2 text-right">
                  <HttpTriggerRowActions
                    httpTriggerId={trigger.id}
                    httpTriggerName={trigger.name}
                    method={trigger.method}
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
