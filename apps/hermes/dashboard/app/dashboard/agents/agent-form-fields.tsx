"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";

const ENDPOINT_TEXTAREA_CLASS = cn(
  "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs outline-none transition-[color,box-shadow]",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
);

type AgentFormFieldsBase = {
  /** Whether the form is submitting. */
  pending: boolean;
  /** Error message to show when submit failed. */
  errorMessage: string | null;
  /** Label for the submit button. */
  submitLabel: string;
};

type AgentFormFieldsCreate = AgentFormFieldsBase & {
  mode: "create";
};

type AgentFormFieldsEdit = AgentFormFieldsBase & {
  mode: "edit";
  id: string;
  initialAgentId: string;
  initialAgentVersion: string;
  initialDescription: string;
  initialEndpointJson: string;
  initialIsActive: boolean;
};

export type AgentFormFieldsProps = AgentFormFieldsCreate | AgentFormFieldsEdit;

/**
 * Shared form fields for create and edit agent: agent ID, version, description, endpoint (JSON), and active.
 * Renders inputs only; parent must wrap in a form (e.g. FormWithAction).
 */
export const AgentFormFields = (props: AgentFormFieldsProps) => {
  const { pending, errorMessage, submitLabel, mode } = props;
  const isEdit = mode === "edit";

  return (
    <>
      {isEdit && (
        <input type="hidden" name="body.id" value={props.id} readOnly />
      )}
      <div className="grid gap-2">
        <Label htmlFor="body.agentId">Agent ID</Label>
        <Input
          id="body.agentId"
          name="body.agentId"
          type="text"
          required
          placeholder="e.g. summarizer"
          disabled={pending}
          {...(isEdit && { defaultValue: props.initialAgentId })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body.agentVersion">Agent version</Label>
        <Input
          id="body.agentVersion"
          name="body.agentVersion"
          type="text"
          required
          placeholder="e.g. 1.0"
          disabled={pending}
          {...(isEdit && { defaultValue: props.initialAgentVersion })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body.description">Description (optional)</Label>
        <Input
          id="body.description"
          name="body.description"
          type="text"
          placeholder="Short description"
          disabled={pending}
          {...(isEdit && { defaultValue: props.initialDescription })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body.endpoint">Endpoint (JSON object)</Label>
        <textarea
          id="body.endpoint"
          name="body.endpoint"
          rows={isEdit ? 6 : 4}
          required={!isEdit}
          disabled={pending}
          placeholder='{"url": "https://api.example.com"}'
          className={ENDPOINT_TEXTAREA_CLASS}
          {...(isEdit && { defaultValue: props.initialEndpointJson })}
        />
        <p className="text-xs text-muted-foreground">
          {isEdit
            ? "Must be a valid JSON object. Leave unchanged to keep current endpoint."
            : "Must be a valid JSON object. Invalid JSON will cause validation to fail."}
        </p>
      </div>
      <FormBooleanCheckboxField
        name="body.isActive"
        id="body.isActive"
        defaultChecked={isEdit ? props.initialIsActive : true}
        disabled={pending}
        label="Active"
        labelClassName="cursor-pointer text-sm font-normal"
      />
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </>
  );
};
