"use client";

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
import type { PipelineOption } from "../schedules/schedule-form-fields";

const HTTP_METHOD_OPTIONS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;
type HttpMethodOption = (typeof HTTP_METHOD_OPTIONS)[number];

export type HttpTriggerFormFieldsProps = {
  pending: boolean;
  pipelines: PipelineOption[];
  defaultName: string;
  defaultDescription: string;
  defaultPipelineId: string;
  defaultEnabled: boolean;
  defaultMethod: HttpMethodOption;
  defaultTokenHint?: string | null;
  httpTriggerId?: string;
  isEdit?: boolean;
};

/**
 * Form fields for create/edit HTTP trigger.
 */
export const HttpTriggerFormFields = ({
  pending,
  pipelines,
  defaultName,
  defaultDescription,
  defaultPipelineId,
  defaultEnabled,
  defaultMethod,
  defaultTokenHint,
  httpTriggerId,
  isEdit = false,
}: HttpTriggerFormFieldsProps) => {
  const tokenLabel = isEdit
    ? "Bearer token (leave blank to keep current)"
    : "Bearer token";
  const tokenPlaceholder = defaultTokenHint
    ? `Current token ends with ${defaultTokenHint}`
    : "";

  return (
    <FieldGroup>
      {httpTriggerId ? (
        <input type="hidden" name="body.httpTriggerId" value={httpTriggerId} />
      ) : null}
      <Field>
        <FieldLabel htmlFor="http-trigger-name">Name</FieldLabel>
        <Input
          id="http-trigger-name"
          name="body.name"
          defaultValue={defaultName}
          required
          disabled={pending}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="http-trigger-description">Description</FieldLabel>
        <Input
          id="http-trigger-description"
          name="body.description"
          defaultValue={defaultDescription}
          disabled={pending}
        />
      </Field>
      <div className="grid gap-7 sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-4">
        <Field>
          <FieldLabel htmlFor="http-trigger-pipeline">Pipeline</FieldLabel>
          <NativeSelect
            id="http-trigger-pipeline"
            name="body.pipelineId"
            defaultValue={defaultPipelineId}
            required
            disabled={pending}
          >
            <NativeSelectOption value="" disabled>
              Select a pipeline
            </NativeSelectOption>
            {pipelines.map((pipeline) => (
              <NativeSelectOption key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="http-trigger-method">Method</FieldLabel>
          <NativeSelect
            id="http-trigger-method"
            name="body.method"
            defaultValue={defaultMethod}
            required
            disabled={pending}
          >
            {HTTP_METHOD_OPTIONS.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {option}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="http-trigger-token">{tokenLabel}</FieldLabel>
        <Input
          id="http-trigger-token"
          name="body.bearerToken"
          type="password"
          required={!isEdit}
          placeholder={tokenPlaceholder}
          autoComplete="new-password"
          disabled={pending}
        />
        <FieldDescription>
          Callers send this token in the Authorization header.
        </FieldDescription>
      </Field>
      <FormBooleanCheckboxField
        name="body.enabled"
        id="http-trigger-enabled"
        defaultChecked={defaultEnabled}
        checkedSubmitValue="on"
        disabled={pending}
        label="Enabled"
      />
    </FieldGroup>
  );
};
