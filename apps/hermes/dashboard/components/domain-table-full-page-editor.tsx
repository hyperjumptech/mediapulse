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
import { PipelineUsageList } from "@/components/pipeline-usage-list";
import { DomainTableFormFields } from "@/components/domain-table-form-fields";
import { FormErrorAlert } from "@/components/form-error-alert";
import { JsonBlock } from "@/components/json-block";
import { FormStatusSubmitButton } from "@/components/submit-button";
import { useDomainTableFullPageEditor } from "@/hooks/use-domain-table-full-page-editor";
import { runDomainTablePreviewExpansion } from "@/lib/domain-table-full-page-actions";
import type { DomainTableFormField } from "@/lib/domain-table-form-schema";
import type { PipelineUsageSummary } from "@/lib/pipeline-usage";

export type DomainTableFullPageEditorProps = {
  basePath: string;
  fields: DomainTableFormField[];
  mode: "create" | "edit";
  rowId?: string;
  defaultRow?: Record<string, unknown>;
  formAction: (formData: FormData) => Promise<void>;
  integrationId: string;
  showPreview: boolean;
  previewFieldKey?: string;
  usedInPipelines?: PipelineUsageSummary[];
};

export const DomainTableFullPageEditor = ({
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
      <Button variant="outline" asChild className="shrink-0 self-start">
        <Link href={basePath}>Back to list</Link>
      </Button>

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
              <JsonBlock
                value={previewResult.values}
                maxHeight="max-h-[min(60vh,480px)]"
              />
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
