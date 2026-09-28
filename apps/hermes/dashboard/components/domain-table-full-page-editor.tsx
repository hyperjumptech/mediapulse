"use client";

import Link from "next/link";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { FieldGroup } from "@workspace/ui/components/field";
import { Spinner } from "@workspace/ui/components/spinner";
import { PageHeader } from "@/components/page-header";
import { PipelineUsageList } from "@/components/pipeline-usage-list";
import { DomainTableFormFields } from "@/components/domain-table-form-fields";
import { FormErrorAlert } from "@/components/form-error-alert";
import { FormStatusSubmitButton } from "@/components/submit-button";
import { useDomainTableFullPageEditor } from "@/hooks/use-domain-table-full-page-editor";
import { runDomainTablePreviewExpansion } from "@/lib/domain-table-full-page-actions";
import type { DomainTableFormField } from "@/lib/domain-table-form-schema";
import type { PipelineUsageSummary } from "@/lib/pipeline-usage";

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
  /** Registered integration id (preview). */
  integrationId: string;
  /** Whether to show preview (manifest + capability). */
  showPreview: boolean;
  /** Manifest `preview.fieldKey` when preview is enabled. */
  previewFieldKey?: string;
  /** Optional reverse lookup rows for "Used in pipelines". */
  usedInPipelines?: PipelineUsageSummary[];
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
  integrationId,
  showPreview,
  previewFieldKey,
  usedInPipelines,
}: DomainTableFullPageEditorProps) => {
  const {
    formRef,
    previewResult,
    previewLoading,
    previewError,
    runPreviewClick,
  } = useDomainTableFullPageEditor({
    previewFieldKey: showPreview ? previewFieldKey : undefined,
    integrationId,
    runPreview: runDomainTablePreviewExpansion,
  });
  const submitLabel = mode === "create" ? "Create" : "Save";

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
        <FieldGroup>
          <DomainTableFormFields
            fields={fields}
            defaultRow={mode === "edit" ? defaultRow : undefined}
          />
        </FieldGroup>
        <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-end">
          {showPreview && previewFieldKey ? (
            <Button
              type="button"
              variant="outline"
              disabled={previewLoading}
              onClick={() => {
                void runPreviewClick();
              }}
            >
              {previewLoading ? <Spinner aria-hidden="true" /> : null}
              {previewLoading ? "Previewing…" : "Preview"}
            </Button>
          ) : null}
          <FormStatusSubmitButton pendingLabel="Saving…">
            {submitLabel}
          </FormStatusSubmitButton>
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
              <FormErrorAlert
                message={previewError}
                className="wrap-break-word whitespace-pre-wrap"
              />
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

      {usedInPipelines ? (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Used in pipelines</CardTitle>
            <CardDescription>
              Pipelines that reference this expansion string.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PipelineUsageList
              usages={usedInPipelines}
              emptyMessage="This expansion string is not referenced by any pipelines yet."
              ariaLabel="Pipelines using this expansion string"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
