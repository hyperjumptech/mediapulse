"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo } from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { ChevronLeft } from "lucide-react";

import { useFormAction as useCreateFormAction } from "@/app/dashboard/data-source-expansions/actions/create/.generated/use-form-action";
import { useFormAction as useUpdateFormAction } from "@/app/dashboard/data-source-expansions/actions/update/.generated/use-form-action";

import { DataSourceExpansionFormatDocs } from "./data-source-expansion-format-docs";

type DataSourceExpansionFormCreateProps = {
  mode: "create";
};

type DataSourceExpansionFormEditProps = {
  mode: "edit";
  id: string;
  initialName: string;
  initialExpansionString: string;
  initialDescription: string | null;
};

export type DataSourceExpansionFormProps =
  | DataSourceExpansionFormCreateProps
  | DataSourceExpansionFormEditProps;

/**
 * Form for creating or editing a data source expansion. Includes Run/Preview and format docs.
 */
export const DataSourceExpansionForm = (
  props: DataSourceExpansionFormProps,
) => {
  const router = useRouter();
  const isCreate = props.mode === "create";

  const createAction = useCreateFormAction();
  const updateAction = useUpdateFormAction();

  const action = isCreate ? createAction : updateAction;
  const { FormWithAction, state, pending } = action;

  const expansionStringRef = useRef<HTMLTextAreaElement>(null);
  const [previewResult, setPreviewResult] = useState<
    | { success: true; values: unknown[] }
    | { success: false; error: string }
    | null
  >(null);
  const [previewPending, setPreviewPending] = useState(false);

  const errorMessage = useMemo(
    () => (state && state.status === false ? (state.message as string) : null),
    [state],
  );

  const createSuccess = useMemo(
    () => Boolean(state && state.status === true && isCreate),
    [state, isCreate],
  );
  const updateSuccess = useMemo(
    () => Boolean(state && state.status === true && !isCreate),
    [state, isCreate],
  );

  useEffect(() => {
    if (createSuccess) {
      router.push("/dashboard/data-source-expansions");
    }
  }, [createSuccess, router]);

  useEffect(() => {
    if (updateSuccess) {
      router.refresh();
    }
  }, [updateSuccess, router]);

  const handleRunPreview = async () => {
    const raw =
      expansionStringRef.current?.value?.trim() ??
      (props.mode === "edit" ? props.initialExpansionString : "");
    if (!raw) {
      setPreviewResult({ success: false, error: "Enter an expansion string" });
      return;
    }
    setPreviewPending(true);
    setPreviewResult(null);
    try {
      const res = await fetch("/api/data-source-expansions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expansionString: raw }),
      });
      const data = (await res.json()) as
        | { success: true; values: unknown[] }
        | { success: false; error: string };
      setPreviewResult(data);
    } catch {
      setPreviewResult({
        success: false,
        error: "Request failed",
      });
    } finally {
      setPreviewPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/data-source-expansions"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to data source expansions
        </Link>
      </div>

      <FormWithAction className="flex flex-col gap-6">
        {props.mode === "edit" && (
          <input type="hidden" name="body.id" value={props.id} readOnly />
        )}

        <div className="grid gap-2">
          <Label htmlFor="body.name">Name</Label>
          <Input
            id="body.name"
            name="body.name"
            type="text"
            required
            placeholder="e.g. Enabled user tickers"
            disabled={pending}
            defaultValue={props.mode === "edit" ? props.initialName : undefined}
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="body.expansionString">Expansion string</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || previewPending}
              onClick={handleRunPreview}
            >
              {previewPending ? "Running…" : "Run preview"}
            </Button>
          </div>
          <textarea
            ref={expansionStringRef}
            id="body.expansionString"
            name="body.expansionString"
            required
            rows={4}
            disabled={pending}
            placeholder="db:userTicker:all:tickerId?where.enabled=true&distinct=tickerId&take=500"
            className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50"
            defaultValue={
              props.mode === "edit" ? props.initialExpansionString : undefined
            }
          />
          {previewResult && (
            <div
              className="rounded-md border border-border bg-muted/30 p-3 text-sm"
              role="status"
            >
              {previewResult.success ? (
                <>
                  <p className="font-medium text-foreground mb-1">
                    Result ({previewResult.values.length} value
                    {previewResult.values.length !== 1 ? "s" : ""})
                  </p>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                    {JSON.stringify(previewResult.values, null, 2)}
                  </pre>
                </>
              ) : (
                <p className="text-destructive">{previewResult.error}</p>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="body.description">Description (optional)</Label>
          <textarea
            id="body.description"
            name="body.description"
            rows={3}
            disabled={pending}
            placeholder="What this expansion is used for"
            className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50"
            defaultValue={
              props.mode === "edit"
                ? (props.initialDescription ?? "")
                : undefined
            }
          />
        </div>

        {errorMessage && (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending
              ? isCreate
                ? "Creating…"
                : "Saving…"
              : isCreate
                ? "Create"
                : "Save changes"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/data-source-expansions">Cancel</Link>
          </Button>
        </div>
      </FormWithAction>

      <DataSourceExpansionFormatDocs />
    </div>
  );
};
