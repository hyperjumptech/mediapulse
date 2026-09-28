"use client";

import type { Dispatch, SetStateAction } from "react";

import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";

type AgentContractFormFieldsProps = {
  name: string;
  description: string;
  brief: string;
  version: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBriefChange: (value: string) => void;
  onVersionChange: (value: string) => void;
  disabled?: boolean;
};

export const AgentContractFormFields = ({
  name,
  description,
  brief,
  version,
  onNameChange,
  onDescriptionChange,
  onBriefChange,
  onVersionChange,
  disabled = false,
}: AgentContractFormFieldsProps) => {
  return (
    <FieldGroup>
      <div className="grid gap-7 sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-4">
        <Field>
          <FieldLabel htmlFor="contract-name">Name</FieldLabel>
          <Input
            id="contract-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="e.g. Weekly newsletter brief"
            disabled={disabled}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="contract-version">Version</FieldLabel>
          <Input
            id="contract-version"
            value={version}
            onChange={(event) => onVersionChange(event.target.value)}
            placeholder="e.g. 1.0"
            disabled={disabled}
            required
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="contract-description">Description</FieldLabel>
        <Input
          id="contract-description"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Optional short description"
          disabled={disabled}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="contract-brief">Brief</FieldLabel>
        <Textarea
          id="contract-brief"
          value={brief}
          onChange={(event) => onBriefChange(event.target.value)}
          placeholder="Describe the end product: its purpose, sections, audience, and tone. Agents will receive this as context."
          rows={10}
          disabled={disabled}
          required
          className="min-h-48"
        />
      </Field>
    </FieldGroup>
  );
};

export type AgentContractFormState = {
  name: string;
  description: string;
  brief: string;
  version: string;
};

type AgentContractFormContentProps = {
  formState: AgentContractFormState;
  setFormState: Dispatch<SetStateAction<AgentContractFormState>>;
  disabled: boolean;
};

export const isAgentContractFormIncomplete = (
  formState: AgentContractFormState,
): boolean => !formState.name || !formState.brief || !formState.version;

export const AgentContractFormContent = ({
  formState,
  setFormState,
  disabled,
}: AgentContractFormContentProps) => (
  <>
    <input type="hidden" name="body.name" value={formState.name} readOnly />
    <input
      type="hidden"
      name="body.description"
      value={formState.description}
      readOnly
    />
    <input type="hidden" name="body.brief" value={formState.brief} readOnly />
    <input
      type="hidden"
      name="body.version"
      value={formState.version}
      readOnly
    />
    <AgentContractFormFields
      name={formState.name}
      description={formState.description}
      brief={formState.brief}
      version={formState.version}
      onNameChange={(value) =>
        setFormState((previous) => ({ ...previous, name: value }))
      }
      onDescriptionChange={(value) =>
        setFormState((previous) => ({ ...previous, description: value }))
      }
      onBriefChange={(value) =>
        setFormState((previous) => ({ ...previous, brief: value }))
      }
      onVersionChange={(value) =>
        setFormState((previous) => ({ ...previous, version: value }))
      }
      disabled={disabled}
    />
  </>
);
