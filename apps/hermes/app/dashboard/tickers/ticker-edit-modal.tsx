"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";

import { TickerEditForm } from "./ticker-edit-form";
import type { TickersPageResult } from "@/lib/tickers";

type TickerRow = TickersPageResult["tickers"][number];

/** Ticker metadata shape expected by TickerEditForm (object or null). */
type TickerMetadata = Record<string, unknown> | null;

/**
 * Normalizes Prisma JsonValue to the shape expected by TickerEditForm.
 */
const toTickerMetadata = (value: unknown): TickerMetadata => {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

type TickerEditModalProps = {
  tickerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Encapsulates ticker fetch and success handler for the edit modal.
 */
const useTickerEditModalState = (
  tickerId: string | null,
  open: boolean,
  onOpenChange: (open: boolean) => void,
) => {
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

  const handleSuccess = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return { ticker, loading, error, handleSuccess };
};

/**
 * Modal that fetches a ticker by ID and renders the edit form (symbol, name, metadata).
 * Closes on successful save via onOpenChange(false).
 */
export const TickerEditModal = ({
  tickerId,
  open,
  onOpenChange,
}: TickerEditModalProps) => {
  const { ticker, loading, error, handleSuccess } = useTickerEditModalState(
    tickerId,
    open,
    onOpenChange,
  );

  if (!tickerId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] w-[min(42rem,calc(100vw-2rem))] max-w-2xl flex-col overflow-hidden p-6"
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {loading
              ? "Loading…"
              : error
                ? "Error"
                : ticker
                  ? `Edit ticker: ${ticker.symbol}`
                  : "Edit ticker"}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && (
            <p className="text-destructive" role="alert">
              {error}
            </p>
          )}
          {loading && !ticker && (
            <p className="text-muted-foreground">Loading ticker…</p>
          )}
          {ticker && (
            <TickerEditForm
              tickerId={ticker.id}
              initialSymbol={ticker.symbol}
              initialName={ticker.name}
              initialMetadata={toTickerMetadata(ticker.metadata)}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
