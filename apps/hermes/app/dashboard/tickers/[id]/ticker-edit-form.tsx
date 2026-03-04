"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import { useFormAction } from "@/app/dashboard/tickers/actions/update/.generated/use-form-action";

/**
 * Edit ticker form: symbol, name. Uses update action; refreshes on success.
 */
export const TickerEditForm = ({
  tickerId,
  initialSymbol,
  initialName,
}: {
  tickerId: string;
  initialSymbol: string;
  initialName: string;
}) => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message;
    return null;
  }, [state]);

  useEffect(() => {
    if (state && state.status === true) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <FormWithAction className="flex flex-col gap-4 max-w-md">
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
