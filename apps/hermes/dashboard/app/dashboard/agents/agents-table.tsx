"use client";

import Link from "next/link";
import { Bot, SearchX } from "lucide-react";

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
import { RelativeTime } from "@/components/relative-time";
import { StatusBadge } from "@/components/status-badge";
import type {
  AgentsPageResult,
  AgentSortDir,
  AgentSortField,
} from "@/lib/agents";
import { buildListHref, nextSortDirection } from "@/lib/list-page-params";

import { AgentRowActions } from "./agent-row-actions";

type AgentRow = AgentsPageResult["agents"][number];

type ViewAgentHandler = (agent: AgentRow) => void;

const BASE_PATH = "/dashboard/agents";

const NAME_CLASS =
  "text-left font-medium text-foreground underline-offset-4 hover:underline";

type AgentsTableProps = {
  agents: AgentRow[];
  sortBy: AgentSortField;
  sortDir: AgentSortDir;
  pageSize: number;
  searchQuery?: string;
  onView?: ViewAgentHandler;
};

const AgentsEmptyState = ({
  searchQuery,
  clearSearchHref,
}: {
  searchQuery?: string;
  clearSearchHref: string;
}) => {
  if (searchQuery) {
    return (
      <Empty className="gap-4 py-12 md:py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX aria-hidden className="size-5 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle className="text-base">
            No agents match “{searchQuery}”
          </EmptyTitle>
          <EmptyDescription>
            Try a different agent ID or description.
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
          <Bot aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base">No agents registered</EmptyTitle>
        <EmptyDescription>
          Agents appear here after they register with Hermes.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

const AgentName = ({
  agent,
  onView,
}: {
  agent: AgentRow;
  onView?: ViewAgentHandler;
}) => {
  if (onView) {
    return (
      <button
        type="button"
        onClick={() => onView(agent)}
        className={NAME_CLASS}
      >
        {agent.agentId}
      </button>
    );
  }

  return (
    <Link href={`${BASE_PATH}/${agent.id}`} className={NAME_CLASS}>
      {agent.agentId}
    </Link>
  );
};

export const AgentsTable = ({
  agents,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
  onView,
}: AgentsTableProps) => {
  const clearSearchHref = buildListHref(BASE_PATH, {
    pageSize,
    sortBy,
    sortDir,
  });

  const sortHeader = (field: AgentSortField, label: string) => {
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

  if (agents.length === 0) {
    return (
      <DataTableCard>
        <AgentsEmptyState
          searchQuery={searchQuery}
          clearSearchHref={clearSearchHref}
        />
      </DataTableCard>
    );
  }

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">
              {sortHeader("agentId", "Agent ID")}
            </TableHead>
            <TableHead>{sortHeader("agentVersion", "Version")}</TableHead>
            <TableHead className="hidden lg:table-cell">Integration</TableHead>
            <TableHead className="hidden md:table-cell">Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>{sortHeader("created", "Created")}</TableHead>
            <TableHead className="hidden sm:table-cell">
              {sortHeader("updated", "Updated")}
            </TableHead>
            <TableHead className="w-12 pr-2">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => {
            const agentLabel = `${agent.agentId}@${agent.agentVersion}`;
            const description = agent.description ?? "—";

            return (
              <TableRow key={agent.id}>
                <TableCell className="pl-4">
                  <AgentName agent={agent} onView={onView} />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {agent.agentVersion}
                </TableCell>
                <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                  {agent.domainIntegration.integrationId}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  <div
                    className="max-w-xs truncate"
                    title={agent.description ?? undefined}
                  >
                    {description}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={agent.isActive ? "active" : "inactive"}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <RelativeTime value={agent.createdAt} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  <RelativeTime value={agent.updatedAt} />
                </TableCell>
                <TableCell className="pr-2 text-right">
                  <AgentRowActions
                    agent={agent}
                    agentLabel={agentLabel}
                    onView={onView}
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
