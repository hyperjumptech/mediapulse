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

import {
  AgentContractRowActions,
  type AgentContractRow,
} from "./agent-contract-row-actions";
import type {
  AgentContractSortDir,
  AgentContractSortField,
} from "@/lib/agent-contracts";
import { formatCreatedBy } from "@/lib/format-created-by";

const BASE_PATH = "/dashboard/agent-contracts";

const buildSortHref = (
  sortBy: AgentContractSortField,
  sortDir: AgentContractSortDir,
  pageSize: number,
): string => {
  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("size", String(pageSize));
  params.set("sort", sortBy);
  params.set("dir", sortDir);
  return `${BASE_PATH}?${params.toString()}`;
};

type AgentContractsTableProps = {
  contracts: AgentContractRow[];
  sortBy: AgentContractSortField;
  sortDir: AgentContractSortDir;
  pageSize: number;
  onEdit: (contract: AgentContractRow) => void;
};

export const AgentContractsTable = ({
  contracts,
  sortBy,
  sortDir,
  pageSize,
  onEdit,
}: AgentContractsTableProps) => {
  const sortLink = (field: AgentContractSortField, label: string) => {
    const isActive = sortBy === field;
    const nextDir: AgentContractSortDir =
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
            <TableHead>Version</TableHead>
            <TableHead>{sortLink("createdAt", "Created")}</TableHead>
            <TableHead>Created by</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground"
              >
                No agent contracts yet.
              </TableCell>
            </TableRow>
          ) : (
            contracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell className="font-medium">
                  <button
                    type="button"
                    onClick={() => onEdit(contract)}
                    className="text-left underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground hover:text-foreground"
                    aria-label={`Edit contract ${contract.name}`}
                  >
                    {contract.name}
                  </button>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">
                  {contract.description ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {contract.version}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(contract.createdAt, "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatCreatedBy(contract.createdBy)}
                </TableCell>
                <TableCell>
                  <AgentContractRowActions
                    contract={contract}
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
