import type { StringFieldProps } from "@workspace/json-schema-form";

import {
  VariableExpansionInput,
  type VariableExpansionInputProps,
} from "./variable-expansion-input";

/** Loaders and optional page size for the variable/expansion picker. */
export type VariableExpansionStringFieldLoaders = Pick<
  VariableExpansionInputProps,
  | "loadVariablesPage"
  | "loadExpansionsPage"
  | "resolveExpansionNameById"
  | "initialExpansionNames"
  | "pageSize"
>;

/**
 * Creates a JsonSchemaForm StringField component that supports inserting
 * variable placeholders and data-source expansion templates via the modal picker.
 *
 * @param loaders - Server-backed loaders for variables and expansions pages.
 * @returns A StringField component for JsonSchemaForm `components.StringField`.
 */
export const createVariableExpansionStringField = (
  loaders: VariableExpansionStringFieldLoaders,
) => {
  const VariableExpansionStringField = (props: StringFieldProps) => (
    <VariableExpansionInput
      value={props.value}
      onChange={props.onChange}
      id={props.id}
      label={props.labelText}
      description={props.description}
      disabled={props.disabled}
      loadVariablesPage={loaders.loadVariablesPage}
      loadExpansionsPage={loaders.loadExpansionsPage}
      resolveExpansionNameById={loaders.resolveExpansionNameById}
      initialExpansionNames={loaders.initialExpansionNames}
      pageSize={loaders.pageSize}
    />
  );

  return VariableExpansionStringField;
};
