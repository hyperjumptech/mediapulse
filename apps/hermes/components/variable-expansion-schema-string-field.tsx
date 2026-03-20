"use client";

import type { StringFieldProps } from "@workspace/json-schema-form";

import {
  VariableExpansionInput,
  type ExpansionOption,
  type VariableOption,
} from "@/components/variable-expansion-input";

/**
 * Creates a JsonSchemaForm StringField component that supports inserting
 * variable placeholders and data-source expansion templates.
 *
 * @param variables - Variable placeholders available to insert ({{key}}).
 * @param expansions - Data source expansion templates available to insert.
 * @returns A StringField component for JsonSchemaForm `components.StringField`.
 */
export const createVariableExpansionStringField = (
  variables: VariableOption[],
  expansions: ExpansionOption[],
) => {
  const VariableExpansionStringField = (props: StringFieldProps) => (
    <VariableExpansionInput
      value={props.value}
      onChange={props.onChange}
      id={props.id}
      label={props.labelText}
      description={props.description}
      disabled={props.disabled}
      variables={variables}
      expansions={expansions}
    />
  );

  return VariableExpansionStringField;
};
