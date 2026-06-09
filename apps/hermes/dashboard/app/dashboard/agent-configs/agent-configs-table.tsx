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
import { Badge } from "@workspace/ui/components/badge";

import {
  AgentConfigRowActions,
  type AgentConfigRow,
} from "./agent-config-row-actions";
import type {
  AgentConfigSortDir,
  AgentConfigSortField,
} from "@/lib/agent-configs";
import { formatCreatedBy } from "@/lib/format-created-by";

const BASE_PATH = "/dashboard/agent-configs";

const buildSortHref = (
  sortBy: AgentConfigSortField,
  sortDir: AgentConfigSortDir,
  pageSize: number,
): string => {
  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("size", String(pageSize));
  params.set("sort", sortBy);
  params.set("dir", sortDir);
  return `${BASE_PATH}?${params.toString()}`;
};

type AgentConfigsTableProps = {
  configs: AgentConfigRow[];
  sortBy: AgentConfigSortField;
  sortDir: AgentConfigSortDir;
  pageSize: number;
};

/**
 * Renders the agent configs list as a table with sortable columns and row actions.
 */
export const AgentConfigsTable = ({
  configs,
  sortBy,
  sortDir,
  pageSize,
}: AgentConfigsTableProps) => {
  const sortLink = (field: AgentConfigSortField, label: string) => {
    const isActive = sortBy === field;
    const nextDir: AgentConfigSortDir =
      isActive && sortDir === "asc" ? "desc" : "asc";
    const href = buildSortHref(field, isActive ? nextDir : "asc", pageSize);
    const Icon = isActive
      ? sortDir === "asc"
        ? ArrowUp
        : ArrowDown
      : ArrowUpDown;
    return (
      <Link
        href={href}
        className="inline-flex items-center gap-1 hover:underline"
      >
        {label}
        <Icon className="size-4" />
      </Link>
    );
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-muted hover:bg-transparent">
            <TableHead>{sortLink("name", "Name")}</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>{sortLink("agentId", "Agent")}</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>{sortLink("createdAt", "Created")}</TableHead>
            <TableHead>Created by</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {configs.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground"
              >
                No agent configs yet.
              </TableCell>
            </TableRow>
          ) : (
            configs.map((config) => (
              <TableRow key={config.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/agent-configs/${config.id}/edit`}
                    className="underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground hover:text-foreground"
                  >
                    {config.name}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">
                  {config.description ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {config.agentId}@{config.agentVersion}
                </TableCell>
                <TableCell>
                  {config.schemaValid ? (
                    <Badge variant="secondary">Valid</Badge>
                  ) : (
                    <Badge variant="destructive">Schema changed</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(config.createdAt, "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatCreatedBy(config.createdBy)}
                </TableCell>
                <TableCell>
                  <AgentConfigRowActions
                    config={config}
                    configLabel={config.name}
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
