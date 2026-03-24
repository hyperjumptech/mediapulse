"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";
import type { PipelineOption } from "../schedules/schedule-form-fields";

const HTTP_METHOD_OPTIONS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;
type HttpMethodOption = (typeof HTTP_METHOD_OPTIONS)[number];

export type HttpTriggerFormFieldsProps = {
  pending: boolean;
  errorMessage: string | null;
  submitLabel: string;
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
  errorMessage,
  submitLabel,
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
  return (
    <>
      {httpTriggerId ? (
        <input type="hidden" name="body.httpTriggerId" value={httpTriggerId} />
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="http-trigger-name">Name</Label>
        <Input
          id="http-trigger-name"
          name="body.name"
          defaultValue={defaultName}
          required
          disabled={pending}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="http-trigger-description">Description</Label>
        <Input
          id="http-trigger-description"
          name="body.description"
          defaultValue={defaultDescription}
          disabled={pending}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="http-trigger-pipeline">Pipeline</Label>
        <select
          id="http-trigger-pipeline"
          name="body.pipelineId"
          defaultValue={defaultPipelineId}
          className="h-9 rounded-md border bg-background px-3 text-sm"
          required
          disabled={pending}
        >
          <option value="" disabled>
            Select a pipeline
          </option>
          {pipelines.map((pipeline) => (
            <option key={pipeline.id} value={pipeline.id}>
              {pipeline.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="http-trigger-method">Method</Label>
        <select
          id="http-trigger-method"
          name="body.method"
          defaultValue={defaultMethod}
          className="h-9 rounded-md border bg-background px-3 text-sm"
          required
          disabled={pending}
        >
          {HTTP_METHOD_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <FormBooleanCheckboxField
        name="body.enabled"
        id="http-trigger-enabled"
        defaultChecked={defaultEnabled}
        checkedSubmitValue="on"
        disabled={pending}
        label="Enabled"
        labelClassName="cursor-pointer"
      />

      <div className="grid gap-2">
        <Label htmlFor="http-trigger-token">
          {isEdit
            ? "Bearer token (leave blank to keep current)"
            : "Bearer token"}
        </Label>
        <Input
          id="http-trigger-token"
          name="body.bearerToken"
          type="password"
          required={!isEdit}
          placeholder={
            defaultTokenHint
              ? `Current token ends with ${defaultTokenHint}`
              : ""
          }
          disabled={pending}
        />
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </>
  );
};
