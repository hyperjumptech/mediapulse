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

import { ApiKeyRowActions } from "./api-key-row-actions";
import { format } from "date-fns";
import type {
  ApiKeysPageResult,
  ApiKeySortDir,
  ApiKeySortField,
} from "@/lib/api-keys";

type ApiKeyRow = ApiKeysPageResult["apiKeys"][number];

const BASE_PATH = "/dashboard/api-keys";

/**
 * Builds API keys list URL with sort (resets to page 1 when sort changes).
 */
const buildSortHref = (
  sortBy: ApiKeySortField,
  sortDir: ApiKeySortDir,
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

type ApiKeysTableProps = {
  apiKeys: ApiKeyRow[];
  sortBy: ApiKeySortField;
  sortDir: ApiKeySortDir;
  pageSize: number;
  searchQuery?: string;
  /** When provided, Edit opens the edit modal via this callback. */
  onEdit?: (apiKey: ApiKeyRow) => void;
};

/**
 * Renders the API keys list as a table with sortable Name, User, Active, Created columns and row actions.
 */
export const ApiKeysTable = ({
  apiKeys,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
  onEdit,
}: ApiKeysTableProps) => {
  const sortLink = (field: ApiKeySortField, label: string) => {
    const isActive = sortBy === field;
    const nextDir: ApiKeySortDir =
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
            <TableHead className="w-[180px]">
              {sortLink("name", "Name")}
            </TableHead>
            <TableHead className="w-[200px]">User</TableHead>
            <TableHead className="w-[80px]">Active</TableHead>
            <TableHead className="w-[120px]">
              {sortLink("created", "Created")}
            </TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {apiKeys.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground"
              >
                No API keys yet.
              </TableCell>
            </TableRow>
          ) : (
            apiKeys.map((apiKey) => (
              <TableRow key={apiKey.id}>
                <TableCell className="font-medium">
                  {onEdit ? (
                    <button
                      type="button"
                      onClick={() => onEdit(apiKey)}
                      className="text-left underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground hover:text-foreground"
                    >
                      {apiKey.name}
                    </button>
                  ) : (
                    apiKey.name
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {apiKey.user.email}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={apiKey.isActive ? "default" : "secondary"}
                    className="font-normal"
                  >
                    {apiKey.isActive ? "Yes" : "No"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(apiKey.createdAt, "LLL d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <ApiKeyRowActions
                    apiKey={apiKey}
                    apiKeyLabel={apiKey.name}
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
