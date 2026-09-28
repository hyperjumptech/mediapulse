"use client";

import Link from "next/link";

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";

import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";
import { usePipelineTimeoutInputDefaultValue } from "@/hooks/use-pipeline-timeout-input-default-value";
import { usePipelineTimeoutPreview } from "@/hooks/use-pipeline-timeout-preview";

import type { PipelineDomainIntegrationOption } from "./pipelines-with-modal";

export type PipelineFormFieldsProps = {
  /** Name prefix for form fields, e.g. "body" for body.name */
  namePrefix?: string;
  pending: boolean;
  defaultName: string;
  defaultDescription: string;
  defaultIsActive: boolean;
  /** Per-agent invocation timeout in milliseconds. Omit for Hermes default (5 minutes). */
  defaultTimeoutMs?: number;
  /** When set, renders hidden pipelineId for update action */
  pipelineId?: string;
  /** Domain integrations for the pipeline owner picker (same order as create fallback). */
  domainIntegrations: PipelineDomainIntegrationOption[];
  /** Selected integration id for edit, or omit on create to default to first option. */
  defaultDomainIntegrationId?: string;
};

/**
 * Shared pipeline form fields: domain integration, name, description, optional agent request timeout, isActive.
 * Used by both create and edit modals to avoid duplication.
 */
export const PipelineFormFields = ({
  namePrefix = "body",
  pending,
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
    <FieldGroup>
      {pipelineId != null ? (
        <input
          type="hidden"
          name={`${pre}pipelineId`}
          value={pipelineId}
          readOnly
        />
      ) : null}
      <Field>
        <FieldLabel htmlFor={`${pre}domainIntegrationId`}>
          Domain integration
        </FieldLabel>
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
          <NativeSelect
            id={`${pre}domainIntegrationId`}
            name={`${pre}domainIntegrationId`}
            defaultValue={selectDefaultValue}
            disabled={pending}
            required
          >
            {domainIntegrations.map((row) => (
              <NativeSelectOption key={row.id} value={row.id}>
                {row.integrationId} — {row.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <FieldDescription>
          Pipelines are scoped to one integration (JWT mint, agent registry, and
          step expansion). Must match where agents are registered.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${pre}name`}>Name</FieldLabel>
        <Input
          id={`${pre}name`}
          name={`${pre}name`}
          type="text"
          required
          placeholder="My pipeline"
          defaultValue={defaultName}
          disabled={pending}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${pre}description`}>Description</FieldLabel>
        <Input
          id={`${pre}description`}
          name={`${pre}description`}
          type="text"
          placeholder="Optional description"
          defaultValue={defaultDescription}
          disabled={pending}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${pre}timeout`}>
          Agent request timeout (ms)
        </FieldLabel>
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
        <FieldDescription>
          Optional. Leave empty for the Hermes default (5 minutes).
        </FieldDescription>
        <FieldDescription aria-live="polite" role="status">
          {timeoutPreviewText}
        </FieldDescription>
      </Field>
      <FormBooleanCheckboxField
        name={`${pre}isActive`}
        id={`${pre}isActive`}
        defaultChecked={defaultIsActive}
        disabled={pending}
        label="Active"
      />
    </FieldGroup>
  );
};
