"use client";

import { useState } from "react";
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

import { TickerDetailDialog } from "./ticker-detail-dialog";
import { TickerEditModal } from "./ticker-edit-modal";
import { TickerRowActions } from "./ticker-row-actions";
import { format } from "date-fns";
import type {
  TickersPageResult,
  TickerSortDir,
  TickerSortField,
} from "@/lib/tickers";

type TickerRow = TickersPageResult["tickers"][number];

const BASE_PATH = "/dashboard/tickers";

/**
 * Builds tickers list URL with sort (resets to page 1 when sort changes).
 */
const buildSortHref = (
  sortBy: TickerSortField,
  sortDir: TickerSortDir,
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

type TickersTableProps = {
  tickers: TickerRow[];
  sortBy: TickerSortField;
  sortDir: TickerSortDir;
  pageSize: number;
  searchQuery?: string;
};

/**
 * Renders the tickers list as a table with sortable Symbol, Name, Created columns and row actions.
 * Clicking symbol or name opens a dialog with full ticker data and metadata as rows.
 */
export const TickersTable = ({
  tickers,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
}: TickersTableProps) => {
  const [detailTickerId, setDetailTickerId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editTickerId, setEditTickerId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const openDetail = (ticker: TickerRow) => {
    setDetailTickerId(ticker.id);
    setDetailOpen(true);
  };

  const openEdit = (id: string) => {
    setEditTickerId(id);
    setEditOpen(true);
  };

  const sortLink = (field: TickerSortField, label: string) => {
    const isActive = sortBy === field;
    const nextDir: TickerSortDir =
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
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-muted hover:bg-transparent">
              <TableHead className="w-[120px]">
                {sortLink("symbol", "Symbol")}
              </TableHead>
              <TableHead>{sortLink("name", "Name")}</TableHead>
              <TableHead>{sortLink("created", "Created")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  No tickers yet.
                </TableCell>
              </TableRow>
            ) : (
              tickers.map((ticker) => (
                <TableRow key={ticker.id}>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      onClick={() => openDetail(ticker)}
                      className="cursor-pointer text-left underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground hover:text-foreground"
                    >
                      {ticker.symbol}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => openDetail(ticker)}
                      className="cursor-pointer text-left underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground hover:text-foreground"
                    >
                      {ticker.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(ticker.createdAt, "LLL d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <TickerRowActions
                      tickerId={ticker.id}
                      tickerSymbol={ticker.symbol}
                      onEditClick={openEdit}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <TickerDetailDialog
        tickerId={detailTickerId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      <TickerEditModal
        tickerId={editTickerId}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditTickerId(null);
        }}
      />
    </>
  );
};
