"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import {
  API_KEY_PURPOSE_LABELS,
  API_KEY_PURPOSE_VALUES,
} from "./api-key-purposes";

type ApiKeyFormFieldsBase = {
  /** Whether the form is submitting. */
  pending: boolean;
  /** Error message to show when submit failed. */
  errorMessage: string | null;
  /** Label for the submit button. */
  submitLabel: string;
};

type ApiKeyFormFieldsCreate = ApiKeyFormFieldsBase & {
  mode: "create";
};

type ApiKeyFormFieldsEdit = ApiKeyFormFieldsBase & {
  mode: "edit";
  id: string;
  initialName: string;
  initialIsActive: boolean;
};

export type ApiKeyFormFieldsProps =
  | ApiKeyFormFieldsCreate
  | ApiKeyFormFieldsEdit;

/**
 * Shared form fields for create and edit API key: name; edit adds isActive.
 * Renders inputs only; parent must wrap in a form (e.g. FormWithAction).
 */
export const ApiKeyFormFields = (props: ApiKeyFormFieldsProps) => {
  const { pending, errorMessage, submitLabel, mode } = props;
  const isEdit = mode === "edit";

  return (
    <>
      {isEdit && (
        <input type="hidden" name="body.id" value={props.id} readOnly />
      )}
      <div className="grid gap-2">
        <Label htmlFor="body.name">Name</Label>
        <Input
          id="body.name"
          name="body.name"
          type="text"
          required
          placeholder="e.g. Production key"
          disabled={pending}
          {...(isEdit && { defaultValue: props.initialName })}
        />
      </div>
      {!isEdit && (
        <div className="grid gap-2">
          <Label htmlFor="body.purpose">Purpose</Label>
          <select
            id="body.purpose"
            name="body.purpose"
            className="border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending}
            defaultValue="domain_integration"
            aria-label="API key purpose"
          >
            {API_KEY_PURPOSE_VALUES.map((value) => (
              <option key={value} value={value}>
                {API_KEY_PURPOSE_LABELS[value]}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            Use <strong>Domain integration</strong> for Mediapulse and agent
            auto-register (mint JWT via agent-auth).
          </p>
        </div>
      )}
      {isEdit && (
        <div className="flex items-center gap-2">
          <input type="hidden" name="body.isActive" value="false" />
          <input
            type="checkbox"
            id="body.isActive"
            name="body.isActive"
            value="true"
            defaultChecked={props.initialIsActive}
            disabled={pending}
            className="size-4 rounded border-input"
          />
          <Label
            htmlFor="body.isActive"
            className="cursor-pointer text-sm font-normal"
          >
            Active
          </Label>
        </div>
      )}
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
