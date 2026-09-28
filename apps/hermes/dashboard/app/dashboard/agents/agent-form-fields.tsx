"use client";

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";

import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";

type AgentFormFieldsBase = {
  /** Whether the form is submitting. */
  pending: boolean;
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
  const { pending, mode } = props;
  const isEdit = mode === "edit";
  const endpointHint = isEdit
    ? "Must be a valid JSON object. Leave unchanged to keep current endpoint."
    : "Must be a valid JSON object. Invalid JSON will cause validation to fail.";

  return (
    <FieldGroup>
      {isEdit && (
        <input type="hidden" name="body.id" value={props.id} readOnly />
      )}
      <div className="grid gap-7 sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-4">
        <Field>
          <FieldLabel htmlFor="body.agentId">Agent ID</FieldLabel>
          <Input
            id="body.agentId"
            name="body.agentId"
            type="text"
            required
            placeholder="e.g. summarizer"
            disabled={pending}
            {...(isEdit && { defaultValue: props.initialAgentId })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="body.agentVersion">Agent version</FieldLabel>
          <Input
            id="body.agentVersion"
            name="body.agentVersion"
            type="text"
            required
            placeholder="e.g. 1.0"
            disabled={pending}
            {...(isEdit && { defaultValue: props.initialAgentVersion })}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="body.description">
          Description (optional)
        </FieldLabel>
        <Input
          id="body.description"
          name="body.description"
          type="text"
          placeholder="Short description"
          disabled={pending}
          {...(isEdit && { defaultValue: props.initialDescription })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="body.endpoint">Endpoint (JSON object)</FieldLabel>
        <Textarea
          id="body.endpoint"
          name="body.endpoint"
          rows={isEdit ? 6 : 4}
          required={!isEdit}
          disabled={pending}
          placeholder='{"url": "https://api.example.com"}'
          className="min-h-24 font-mono"
          {...(isEdit && { defaultValue: props.initialEndpointJson })}
        />
        <FieldDescription>{endpointHint}</FieldDescription>
      </Field>
      <FormBooleanCheckboxField
        name="body.isActive"
        id="body.isActive"
        defaultChecked={isEdit ? props.initialIsActive : true}
        disabled={pending}
        label="Active"
      />
    </FieldGroup>
  );
};
