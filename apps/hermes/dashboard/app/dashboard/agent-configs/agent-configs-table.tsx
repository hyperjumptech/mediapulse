"use client";

import Link from "next/link";
import { Plus, SlidersHorizontal } from "lucide-react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

import { DataTableCard } from "@/components/data-table/data-table-card";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { DateTime } from "@/components/date-time/date-time";
import { StatusBadge } from "@/components/status-badge";
import type {
  AgentConfigSortDir,
  AgentConfigSortField,
} from "@/lib/agent-configs";
import { formatCreatedBy } from "@/lib/format-created-by";
import { buildListHref, nextSortDirection } from "@/lib/list-page-params";

import {
  AgentConfigRowActions,
  type AgentConfigRow,
} from "./agent-config-row-actions";

const BASE_PATH = "/dashboard/agent-configs";

type AgentConfigsTableProps = {
  configs: AgentConfigRow[];
  sortBy: AgentConfigSortField;
  sortDir: AgentConfigSortDir;
  pageSize: number;
};

const AgentConfigsEmptyState = () => {
  return (
    <Empty className="gap-4 py-12 md:py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SlidersHorizontal
            aria-hidden
            className="size-5 text-muted-foreground"
          />
        </EmptyMedia>
        <EmptyTitle className="text-base">No agent configs yet</EmptyTitle>
        <EmptyDescription>
          Save reusable settings for an agent as a preset.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm" asChild>
          <Link href={`${BASE_PATH}/new`}>
            <Plus aria-hidden />
            Add config
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
};

const SchemaStatus = ({ schemaValid }: { schemaValid: boolean }) => {
  if (schemaValid) {
    return <span className="text-sm text-muted-foreground">Up to date</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <StatusBadge status="invalid" label="Schema changed" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        The agent&apos;s config schema changed after this preset was saved. Edit
        the preset to review its fields.
      </TooltipContent>
    </Tooltip>
  );
};

export const AgentConfigsTable = ({
  configs,
  sortBy,
  sortDir,
  pageSize,
}: AgentConfigsTableProps) => {
  const sortHeader = (field: AgentConfigSortField, label: string) => {
    const direction = nextSortDirection(field, sortBy, sortDir);
    const href = buildListHref(BASE_PATH, {
      pageSize,
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

  if (configs.length === 0) {
    return (
      <DataTableCard>
        <AgentConfigsEmptyState />
      </DataTableCard>
    );
  }

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">{sortHeader("name", "Name")}</TableHead>
            <TableHead>{sortHeader("agentId", "Agent")}</TableHead>
            <TableHead className="hidden lg:table-cell">Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>{sortHeader("createdAt", "Created")}</TableHead>
            <TableHead className="hidden md:table-cell">Created by</TableHead>
            <TableHead className="w-12 pr-2">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {configs.map((config) => {
            const agentLabel = `${config.agentId}@${config.agentVersion}`;
            const description = config.description ?? "—";

            return (
              <TableRow key={config.id}>
                <TableCell className="pl-4">
                  <Link
                    href={`${BASE_PATH}/${config.id}/edit`}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {config.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {agentLabel}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  <div
                    className="max-w-xs truncate"
                    title={config.description ?? undefined}
                  >
                    {description}
                  </div>
                </TableCell>
                <TableCell>
                  <SchemaStatus schemaValid={config.schemaValid} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <DateTime value={config.createdAt} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatCreatedBy(config.createdBy)}
                </TableCell>
                <TableCell className="pr-2 text-right">
                  <AgentConfigRowActions
                    config={config}
                    configLabel={config.name}
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
