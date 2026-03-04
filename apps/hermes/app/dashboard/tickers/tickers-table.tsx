"use client";

import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { TickerDetailDialog } from "./ticker-detail-dialog";
import { TickerRowActions } from "./ticker-row-actions";
import { format } from "date-fns";
import type { TickersPageResult } from "@/lib/tickers";

type TickerRow = TickersPageResult["tickers"][number];

/**
 * Renders the tickers list as a table with Symbol, Name, Created, and row actions dropdown.
 * Clicking symbol or name opens a dialog with full ticker data and metadata as rows.
 */
export const TickersTable = ({ tickers }: { tickers: TickerRow[] }) => {
  const [detailTickerId, setDetailTickerId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (ticker: TickerRow) => {
    setDetailTickerId(ticker.id);
    setDetailOpen(true);
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-muted hover:bg-transparent">
              <TableHead className="w-[120px]">Symbol</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Created</TableHead>
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
    </>
  );
};
