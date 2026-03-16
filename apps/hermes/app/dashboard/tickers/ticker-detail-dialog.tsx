"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import type { TickersPageResult } from "@/lib/tickers";

type TickerRow = TickersPageResult["tickers"][number];

type MetadataEntry = { key: string; value: string };

/**
 * Converts a JSON-serializable value to a display string for metadata rows.
 */
const formatMetadataValue = (value: unknown): string => {
  if (value === null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

/**
 * Flattens ticker metadata into key-value rows for display.
 * Top-level keys only; nested objects are stringified.
 *
 * @param metadata - Raw metadata (JSON object or null).
 * @returns Array of { key, value } for table rows.
 */
export const metadataToRows = (metadata: unknown): MetadataEntry[] => {
  if (metadata === null || metadata === undefined) return [];
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    return [{ key: "—", value: formatMetadataValue(metadata) }];
  }
  const record = metadata as Record<string, unknown>;
  return Object.keys(record)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({ key, value: formatMetadataValue(record[key]) }));
};

/** Formats a date (Date or ISO string from server serialization) for display. */
const formatDate = (d: Date | string): string => new Date(d).toLocaleString();

type TickerDetailDialogProps = {
  tickerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Encapsulates ticker fetch for the detail dialog.
 */
const useTickerDetailDialogState = (tickerId: string | null, open: boolean) => {
  const [ticker, setTicker] = useState<TickerRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTicker = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickers/${encodeURIComponent(id)}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed to load ticker (${res.status})`);
      }
      const data = (await res.json()) as TickerRow;
      setTicker(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticker");
      setTicker(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && tickerId) {
      fetchTicker(tickerId);
    } else if (!open) {
      setTicker(null);
      setError(null);
    }
  }, [open, tickerId, fetchTicker]);

  const metaRows = useMemo(
    () => (ticker ? metadataToRows(ticker.metadata) : []),
    [ticker],
  );

  return { ticker, loading, error, metaRows };
};

/**
 * Dialog that shows full ticker data including all metadata as key-value rows.
 * Fetches the ticker by ID when opened so the complete metadata from the DB is shown.
 */
export const TickerDetailDialog = ({
  tickerId,
  open,
  onOpenChange,
}: TickerDetailDialogProps) => {
  const { ticker, loading, error, metaRows } = useTickerDetailDialogState(
    tickerId,
    open,
  );

  if (!tickerId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[80vh] w-[min(42rem,calc(100vw-2rem))] max-w-2xl flex-col overflow-hidden p-6"
        style={{ height: "85vh" }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {loading
              ? "Loading…"
              : error
                ? "Error"
                : ticker
                  ? `${ticker.symbol} — ${ticker.name}`
                  : "Ticker details"}
          </DialogTitle>
        </DialogHeader>
        <div className="relative min-h-0 flex-1">
          <div
            className="h-full overflow-x-hidden overflow-y-scroll [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-muted/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/40"
            style={{ scrollbarGutter: "stable" } as React.CSSProperties}
          >
            <div className="grid gap-6 pb-4 pr-2">
              {error && (
                <p className="text-destructive" role="alert">
                  {error}
                </p>
              )}
              {loading && !ticker && (
                <p className="text-muted-foreground">Loading ticker…</p>
              )}
              {ticker && (
                <>
                  <section>
                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                      Details
                    </h3>
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="border-muted hover:bg-transparent">
                          <TableHead className="w-[140px]">Field</TableHead>
                          <TableHead>Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground">
                            ID
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {ticker.id}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground">
                            Symbol
                          </TableCell>
                          <TableCell>{ticker.symbol}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground">
                            Name
                          </TableCell>
                          <TableCell>{ticker.name}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground">
                            Created
                          </TableCell>
                          <TableCell>{formatDate(ticker.createdAt)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground">
                            Updated
                          </TableCell>
                          <TableCell>{formatDate(ticker.updatedAt)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </section>
                  {metaRows.length > 0 && (
                    <section>
                      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                        Metadata
                      </h3>
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow className="border-muted hover:bg-transparent">
                            <TableHead className="w-[180px]">Key</TableHead>
                            <TableHead>Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {metaRows.map(({ key, value }) => (
                            <TableRow key={key}>
                              <TableCell className="font-medium text-muted-foreground">
                                {key}
                              </TableCell>
                              <TableCell className="whitespace-pre-wrap wrap-break-word font-mono text-sm">
                                {value}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
          {/* Fade at bottom to suggest scrollable content */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-background to-transparent"
            aria-hidden
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
