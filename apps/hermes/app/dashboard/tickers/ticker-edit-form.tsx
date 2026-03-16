"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

import { useFormAction } from "@/app/dashboard/tickers/actions/update/.generated/use-form-action";

/** Ticker metadata is a nullable JSON object (record of string keys to arbitrary values). */
type TickerMetadata = Record<string, unknown> | null;

/**
 * Encapsulates ticker edit form action state, refresh-on-success, and onSuccess callback.
 */
const useTickerEditFormState = (onSuccess?: () => void) => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message;
    return null;
  }, [state]);

  useEffect(() => {
    if (state && state.status === true) {
      router.refresh();
      onSuccess?.();
    }
  }, [state, router, onSuccess]);

  return { FormWithAction, pending, errorMessage };
};

/**
 * Edit ticker form: symbol, name, and metadata (JSON). Uses update action; refreshes on success.
 * Optionally calls onSuccess when save succeeds (e.g. to close a modal).
 */
export const TickerEditForm = ({
  tickerId,
  initialSymbol,
  initialName,
  initialMetadata,
  onSuccess,
}: {
  tickerId: string;
  initialSymbol: string;
  initialName: string;
  initialMetadata?: TickerMetadata;
  /** Called when update succeeds; use to close a modal or navigate. */
  onSuccess?: () => void;
}) => {
  const { FormWithAction, pending, errorMessage } =
    useTickerEditFormState(onSuccess);

  const metadataJson = useMemo(
    () =>
      initialMetadata === undefined || initialMetadata === null
        ? "null"
        : JSON.stringify(initialMetadata, null, 2),
    [initialMetadata],
  );

  return (
    <FormWithAction className="flex flex-col gap-4 max-w-2xl">
      <input type="hidden" name="body.tickerId" value={tickerId} readOnly />
      <div className="grid gap-2">
        <Label htmlFor="body.symbol">Symbol</Label>
        <Input
          id="body.symbol"
          name="body.symbol"
          type="text"
          defaultValue={initialSymbol}
          required
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body.name">Name</Label>
        <Input
          id="body.name"
          name="body.name"
          type="text"
          defaultValue={initialName}
          required
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body.metadata">Metadata (JSON)</Label>
        <textarea
          id="body.metadata"
          name="body.metadata"
          defaultValue={metadataJson}
          rows={14}
          disabled={pending}
          placeholder='{"key": "value"}'
          className={cn(
            "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs outline-none transition-[color,box-shadow]",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <p className="text-xs text-muted-foreground">
          Optional. Use a JSON object or{" "}
          <code className="rounded bg-muted px-1">null</code> to clear. Invalid
          JSON will cause validation to fail.
        </p>
      </div>
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </FormWithAction>
  );
};
