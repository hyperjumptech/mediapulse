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
  onEdit: (config: AgentConfigRow) => void;
  onDuplicate: (config: AgentConfigRow) => void;
};

/**
 * Renders the agent configs list as a table with sortable columns and row actions.
 */
export const AgentConfigsTable = ({
  configs,
  sortBy,
  sortDir,
  pageSize,
  onEdit,
  onDuplicate,
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

  if (configs.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No agent configs yet. Add one to get started.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{sortLink("name", "Name")}</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>{sortLink("agentId", "Agent")}</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>{sortLink("createdAt", "Created")}</TableHead>
          <TableHead className="w-[60px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {configs.map((config) => (
          <TableRow key={config.id}>
            <TableCell className="font-medium">{config.name}</TableCell>
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
            <TableCell>
              <AgentConfigRowActions
                config={config}
                configLabel={config.name}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
