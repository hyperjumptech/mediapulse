"use client";

import { FileText, Plus } from "lucide-react";

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
import type {
  AgentContractSortDir,
  AgentContractSortField,
} from "@/lib/agent-contracts";
import { formatCreatedBy } from "@/lib/format-created-by";
import { buildListHref, nextSortDirection } from "@/lib/list-page-params";

import { AddContractModal } from "./add-contract-modal";
import {
  AgentContractRowActions,
  type AgentContractRow,
} from "./agent-contract-row-actions";

const BASE_PATH = "/dashboard/agent-contracts";

type EditContractHandler = (contract: AgentContractRow) => void;

type AgentContractsTableProps = {
  contracts: AgentContractRow[];
  sortBy: AgentContractSortField;
  sortDir: AgentContractSortDir;
  pageSize: number;
  onEdit: EditContractHandler;
};

const AgentContractsEmptyState = () => {
  return (
    <Empty className="gap-4 py-12 md:py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileText aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base">No agent contracts yet</EmptyTitle>
        <EmptyDescription>
          Write a product brief once and reuse it across agents.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <AddContractModal
          trigger={
            <Button variant="outline" size="sm">
              <Plus aria-hidden />
              Add contract
            </Button>
          }
        />
      </EmptyContent>
    </Empty>
  );
};

export const AgentContractsTable = ({
  contracts,
  sortBy,
  sortDir,
  pageSize,
  onEdit,
}: AgentContractsTableProps) => {
  const sortHeader = (field: AgentContractSortField, label: string) => {
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

  if (contracts.length === 0) {
    return (
      <DataTableCard>
        <AgentContractsEmptyState />
      </DataTableCard>
    );
  }

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">{sortHeader("name", "Name")}</TableHead>
            <TableHead>Version</TableHead>
            <TableHead className="hidden md:table-cell">Description</TableHead>
            <TableHead>{sortHeader("createdAt", "Created")}</TableHead>
            <TableHead className="hidden md:table-cell">Created by</TableHead>
            <TableHead className="w-12 pr-2">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((contract) => {
            const description = contract.description ?? "—";

            return (
              <TableRow key={contract.id}>
                <TableCell className="pl-4">
                  <button
                    type="button"
                    onClick={() => onEdit(contract)}
                    className="text-left font-medium text-foreground underline-offset-4 hover:underline"
                    aria-label={`Edit contract ${contract.name}`}
                  >
                    {contract.name}
                  </button>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {contract.version}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  <div
                    className="max-w-xs truncate"
                    title={contract.description ?? undefined}
                  >
                    {description}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <DateTime value={contract.createdAt} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatCreatedBy(contract.createdBy)}
                </TableCell>
                <TableCell className="pr-2 text-right">
                  <AgentContractRowActions
                    contract={contract}
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
