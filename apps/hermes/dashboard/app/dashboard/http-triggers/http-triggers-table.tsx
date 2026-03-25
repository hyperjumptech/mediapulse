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
import type {
  HttpTriggerSortDir,
  HttpTriggerSortField,
  HttpTriggersPageResult,
} from "@/lib/http-triggers";
import { formatCreatedBy } from "@/lib/format-created-by";
import { HttpTriggerRowActions } from "./http-trigger-row-actions";

type HttpTriggerRow = HttpTriggersPageResult["httpTriggers"][number];
const BASE_PATH = "/dashboard/http-triggers";

const buildSortHref = (
  sortBy: HttpTriggerSortField,
  sortDir: HttpTriggerSortDir,
  pageSize: number,
  searchQuery?: string,
): string => {
  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("size", String(pageSize));
  params.set("sort", sortBy);
  params.set("dir", sortDir);
  if (searchQuery) params.set("q", searchQuery);
  return `${BASE_PATH}?${params.toString()}`;
};

/**
 * Table for HTTP triggers list.
 */
export const HttpTriggersTable = ({
  httpTriggers,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
  onEdit,
}: {
  httpTriggers: HttpTriggerRow[];
  sortBy: HttpTriggerSortField;
  sortDir: HttpTriggerSortDir;
  pageSize: number;
  searchQuery?: string;
  onEdit: (httpTriggerId: string) => void;
}) => {
  const sortLink = (field: HttpTriggerSortField, label: string) => {
    const active = sortBy === field;
    const nextDir: HttpTriggerSortDir =
      active && sortDir === "asc" ? "desc" : "asc";
    const Icon = active
      ? sortDir === "asc"
        ? ArrowUp
        : ArrowDown
      : ArrowUpDown;
    return (
      <Link
        href={buildSortHref(
          field,
          active ? nextDir : "asc",
          pageSize,
          searchQuery,
        )}
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
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
            <TableHead className="w-[100px]">
              {sortLink("method", "Method")}
            </TableHead>
            <TableHead className="w-[80px]">
              {sortLink("enabled", "Enabled")}
            </TableHead>
            <TableHead className="w-[130px]">
              {sortLink("created", "Created")}
            </TableHead>
            <TableHead className="w-[180px]">Created by</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {httpTriggers.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground"
              >
                No HTTP triggers yet.
              </TableCell>
            </TableRow>
          ) : (
            httpTriggers.map((trigger) => (
              <TableRow key={trigger.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/http-triggers/${trigger.id}`}
                    className="underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground hover:text-foreground"
                  >
                    {trigger.name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {trigger.pipeline.name}
                </TableCell>
                <TableCell className="text-sm">{trigger.method}</TableCell>
                <TableCell className="text-sm">
                  {trigger.enabled ? "Yes" : "No"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(trigger.createdAt, "LLL d, yyyy")}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatCreatedBy(trigger.createdBy, trigger.createdById)}
                </TableCell>
                <TableCell className="text-right">
                  <HttpTriggerRowActions
                    httpTriggerId={trigger.id}
                    httpTriggerName={trigger.name}
                    method={trigger.method}
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
