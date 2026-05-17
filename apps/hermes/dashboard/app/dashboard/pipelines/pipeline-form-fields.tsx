"use client";

import Link from "next/link";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";
import { usePipelineTimeoutInputDefaultValue } from "@/hooks/use-pipeline-timeout-input-default-value";
import { usePipelineTimeoutPreview } from "@/hooks/use-pipeline-timeout-preview";

import type { PipelineDomainIntegrationOption } from "./pipelines-with-modal";

export type PipelineFormFieldsProps = {
  /** Name prefix for form fields, e.g. "body" for body.name */
  namePrefix?: string;
  pending: boolean;
  errorMessage: string | null;
  submitLabel: string;
  defaultName: string;
  defaultDescription: string;
  defaultIsActive: boolean;
  /** Per-agent invocation timeout in milliseconds. Omit for Hermes default (5 minutes). */
  defaultTimeoutMs?: number;
  /** When set, renders hidden pipelineId for update action */
  pipelineId?: string;
  /** Domain integrations for the pipeline owner `<select>` (same order as create fallback). */
  domainIntegrations: PipelineDomainIntegrationOption[];
  /** Selected integration id for edit, or omit on create to default to first option. */
  defaultDomainIntegrationId?: string;
};

const selectClassName = cn(
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow]",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "disabled:pointer-events-none disabled:opacity-50",
);

/**
 * Shared pipeline form fields: domain integration, name, description, optional agent request timeout, isActive.
 * Used by both create and edit modals to avoid duplication.
 */
export const PipelineFormFields = ({
  namePrefix = "body",
  pending,
  errorMessage,
  submitLabel,
  defaultName,
  defaultDescription,
  defaultIsActive,
  defaultTimeoutMs,
  pipelineId,
  domainIntegrations,
  defaultDomainIntegrationId,
}: PipelineFormFieldsProps) => {
  const pre = namePrefix ? `${namePrefix}.` : "";
  const timeoutInputDefaultValue =
    usePipelineTimeoutInputDefaultValue(defaultTimeoutMs);
  const { timeoutPreviewText, onTimeoutInput } =
    usePipelineTimeoutPreview(defaultTimeoutMs);

  const selectDefaultValue =
    defaultDomainIntegrationId ?? domainIntegrations[0]?.id ?? "";

  return (
    <>
      {pipelineId != null ? (
        <input
          type="hidden"
          name={`${pre}pipelineId`}
          value={pipelineId}
          readOnly
        />
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor={`${pre}domainIntegrationId`}>Domain integration</Label>
        {domainIntegrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No domain integration configured.{" "}
            <Link
              href="/dashboard/domain-integrations"
              className="text-primary underline underline-offset-4"
            >
              Add one under Domain integrations
            </Link>{" "}
            before creating pipelines.
          </p>
        ) : (
          <select
            id={`${pre}domainIntegrationId`}
            name={`${pre}domainIntegrationId`}
            className={selectClassName}
            defaultValue={selectDefaultValue}
            disabled={pending}
            required
          >
            {domainIntegrations.map((row) => (
              <option key={row.id} value={row.id}>
                {row.integrationId} — {row.name}
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-muted-foreground">
          Pipelines are scoped to one integration (JWT mint, agent registry, and
          step expansion). Must match where agents are registered.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${pre}name`}>Name</Label>
        <Input
          id={`${pre}name`}
          name={`${pre}name`}
          type="text"
          required
          placeholder="My pipeline"
          defaultValue={defaultName}
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${pre}description`}>Description</Label>
        <Input
          id={`${pre}description`}
          name={`${pre}description`}
          type="text"
          placeholder="Optional description"
          defaultValue={defaultDescription}
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${pre}timeout`}>Agent request timeout (ms)</Label>
        <Input
          id={`${pre}timeout`}
          name={`${pre}timeout`}
          type="number"
          min={1}
          defaultValue={timeoutInputDefaultValue}
          placeholder="e.g. 900000"
          disabled={pending}
          onInput={onTimeoutInput}
        />
        <p className="text-xs text-muted-foreground">
          Optional. Leave empty for the Hermes default (5 minutes).
        </p>
        <p
          className="text-xs text-muted-foreground"
          aria-live="polite"
          role="status"
        >
          {timeoutPreviewText}
        </p>
      </div>
      <FormBooleanCheckboxField
        name={`${pre}isActive`}
        id={`${pre}isActive`}
        defaultChecked={defaultIsActive}
        disabled={pending}
        label="Active"
      />
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending || domainIntegrations.length === 0}
      >
        {submitLabel}
      </Button>
    </>
  );
};
