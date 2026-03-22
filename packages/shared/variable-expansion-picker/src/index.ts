/**
 * @workspace/variable-expansion-picker
 *
 * Modal picker for inserting `{{variable}}` placeholders and data-source expansion strings.
 */

export { createVariableExpansionStringField } from "./components/create-variable-expansion-string-field";
export type { VariableExpansionStringFieldLoaders } from "./components/create-variable-expansion-string-field";
export { ExpansionsPickerSection } from "./components/expansions-picker-section";
export { insertAtRange } from "./lib/insert-at-range";
export { PickerTabList } from "./components/picker-tab-list";
export type { VariableExpansionInputProps } from "./components/variable-expansion-input";
export {
  DEFAULT_PICKER_PAGE_SIZE,
  VariableExpansionInput,
} from "./components/variable-expansion-input";
export type {
  ExpansionOption,
  LoadExpansionsPageResult,
  LoadPageArgs,
  LoadVariablesPageResult,
  VariableOption,
} from "./types";
export { useDebouncedValue } from "./hooks/use-debounced-value";
export { usePickerTabListState } from "./hooks/use-picker-tab-list-state";
export type { PickerTabListState } from "./hooks/use-picker-tab-list-state";
export { useTabSearchState } from "./hooks/use-tab-search-state";
export { useVariableExpansionInputCore } from "./hooks/use-variable-expansion-input-core";
export { useVariableExpansionPickerModalShell } from "./hooks/use-variable-expansion-picker-modal-shell";
export type {
  PickerModalTab,
  VariableExpansionPickerModalShell,
} from "./hooks/use-variable-expansion-picker-modal-shell";
export { VariablesPickerSection } from "./components/variables-picker-section";
