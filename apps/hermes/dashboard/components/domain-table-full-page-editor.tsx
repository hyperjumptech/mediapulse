"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { PageHeader } from "@/components/page-header";
import { DomainTableFormFields } from "@/components/domain-table-form-fields";
import { useDomainTableFullPageEditor } from "@/hooks/use-domain-table-full-page-editor";
import { runDomainTablePreviewExpansion } from "@/lib/domain-table-full-page-actions";
import type { DomainTableFormField } from "@/lib/domain-table-form-schema";

/**
 * Submit button that reflects pending state from the parent form action.
 *
 * @returns Primary submit control.
 */
const DomainTableFullPageSubmitButton = ({
  label,
}: {
  /** Visible label when not pending. */
  label: string;
}) => {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
};

export type DomainTableFullPageEditorProps = {
  /** Page title. */
  title: string;
  /** Page description under the title. */
  description: string;
  /** List URL for back navigation. */
  basePath: string;
  /** Parsed form fields from JSON Schema. */
  fields: DomainTableFormField[];
  /** Create vs edit flow. */
  mode: "create" | "edit";
  /** Row id for edit (hidden field). */
  rowId?: string;
  /** Initial values in edit mode. */
  defaultRow?: Record<string, unknown>;
  /** Server action for the form. */
  formAction: (formData: FormData) => Promise<void>;
  /** Registered integration key (preview). */
  integrationKey: string;
  /** Whether to show preview (manifest + capability). */
  showPreview: boolean;
  /** Manifest `preview.fieldKey` when preview is enabled. */
  previewFieldKey?: string;
};

/**
 * Full-page create/edit form for table-v1 resources with optional expansion preview.
 *
 * @param props - Form config, server action, and preview flags.
 * @returns Full-page layout with form and optional preview card.
 */
export const DomainTableFullPageEditor = ({
  title,
  description,
  basePath,
  fields,
  mode,
  rowId,
  defaultRow,
  formAction,
  integrationKey,
  showPreview,
  previewFieldKey,
}: DomainTableFullPageEditorProps) => {
  const {
    formRef,
    previewResult,
    previewLoading,
    previewError,
    runPreviewClick,
  } = useDomainTableFullPageEditor({
    previewFieldKey: showPreview ? previewFieldKey : undefined,
    integrationKey,
    runPreview: runDomainTablePreviewExpansion,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={title} description={description} />
        <Button variant="outline" asChild className="shrink-0 self-start">
          <Link href={basePath}>Back to list</Link>
        </Button>
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="flex max-w-3xl flex-col gap-6"
      >
        {mode === "edit" && rowId ? (
          <input type="hidden" name="__id" value={rowId} readOnly />
        ) : null}
        <DomainTableFormFields
          fields={fields}
          defaultRow={mode === "edit" ? defaultRow : undefined}
        />
        <div className="flex flex-wrap items-center gap-3">
          <DomainTableFullPageSubmitButton
            label={mode === "create" ? "Create" : "Save"}
          />
          {showPreview && previewFieldKey ? (
            <Button
              type="button"
              variant="secondary"
              disabled={previewLoading}
              onClick={() => {
                void runPreviewClick();
              }}
            >
              {previewLoading ? "Previewing…" : "Preview"}
            </Button>
          ) : null}
        </div>
      </form>

      {showPreview && previewFieldKey ? (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Preview result</CardTitle>
            <CardDescription>
              Resolved values for the expansion string (from the domain
              integration).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {previewError ? (
              <p className="break-words text-sm text-destructive whitespace-pre-wrap">
                {previewError}
              </p>
            ) : null}
            {previewResult?.success === true ? (
              <pre className="max-h-[min(60vh,480px)] overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                {JSON.stringify(previewResult.values, null, 2)}
              </pre>
            ) : null}
            {!previewError && previewResult === null ? (
              <p className="text-sm text-muted-foreground">
                Run preview to see resolved values here.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
