"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Badge } from "@workspace/ui/components/badge";

import { AgentRowActions } from "./agent-row-actions";
import { format } from "date-fns";
import type {
  AgentsPageResult,
  AgentSortDir,
  AgentSortField,
} from "@/lib/agents";

type AgentRow = AgentsPageResult["agents"][number];

const BASE_PATH = "/dashboard/agents";

/**
 * Builds agents list URL with sort (resets to page 1 when sort changes).
 */
const buildSortHref = (
  sortBy: AgentSortField,
  sortDir: AgentSortDir,
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

type AgentsTableProps = {
  agents: AgentRow[];
  sortBy: AgentSortField;
  sortDir: AgentSortDir;
  pageSize: number;
  searchQuery?: string;
  /** When provided, View opens the details modal via this callback instead of navigating. */
  onView?: (agent: AgentRow) => void;
};

/**
 * Renders the agents list as a table with sortable Agent ID, Version, Description, Active, Created, Updated columns and row actions.
 */
export const AgentsTable = ({
  agents,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
  onView,
}: AgentsTableProps) => {
  const sortLink = (field: AgentSortField, label: string) => {
    const isActive = sortBy === field;
    const nextDir: AgentSortDir =
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
            <TableHead className="w-[280px]">
              {sortLink("agentId", "Agent ID")}
            </TableHead>
            <TableHead className="w-[100px]">
              {sortLink("agentVersion", "Version")}
            </TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[80px]">Active</TableHead>
            <TableHead className="w-[120px]">
              {sortLink("created", "Created")}
            </TableHead>
            <TableHead className="w-[120px]">
              {sortLink("updated", "Updated")}
            </TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground"
              >
                No agents yet.
              </TableCell>
            </TableRow>
          ) : (
            agents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell className="font-medium">
                  {onView ? (
                    <button
                      type="button"
                      onClick={() => onView(agent)}
                      className="underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground hover:text-foreground text-left"
                    >
                      {agent.agentId}
                    </button>
                  ) : (
                    <Link
                      href={`/dashboard/agents/${agent.id}`}
                      className="underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground hover:text-foreground"
                    >
                      {agent.agentId}
                    </Link>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {agent.agentVersion}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">
                  {agent.description ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={agent.isActive ? "default" : "secondary"}
                    className="font-normal"
                  >
                    {agent.isActive ? "Yes" : "No"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(agent.createdAt, "LLL d, yyyy")}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(agent.updatedAt, "LLL d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <AgentRowActions
                    agent={agent}
                    agentLabel={`${agent.agentId}@${agent.agentVersion}`}
                    onView={onView}
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
