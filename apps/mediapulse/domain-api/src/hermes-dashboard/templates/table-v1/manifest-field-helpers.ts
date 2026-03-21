/**
 * Column `type` values allowed by the Hermes domain contract for `table-v1` pages.
 */
export type ManifestColumnType = "text" | "date-time";

/**
 * One manifest column definition before Zod parsing (matches contract shape).
 */
export type ManifestColumn<K extends string = string> = {
  key: K;
  label: string;
  type: ManifestColumnType;
};

/**
 * Returns a function that accepts `table-v1` column definitions whose `key` must exist on the list-row type `Row`.
 *
 * @typeParam Row - Record representing the JSON object shape of one list item from the domain API.
 * @returns Curried function that returns the same columns, typed for the manifest.
 */
export const columnsFor =
  <Row extends Record<string, unknown>>() =>
  <K extends keyof Row & string>(
    columns: ReadonlyArray<ManifestColumn<K>>,
  ): ManifestColumn<K>[] => [...columns];

/**
 * Returns a function that accepts searchable or sortable field names limited to keys on `Row`.
 *
 * @typeParam Row - Record representing the JSON object shape of one list item from the domain API.
 * @returns Curried function that returns the same key list, typed for the manifest.
 */
export const rowFieldKeysFor =
  <Row extends Record<string, unknown>>() =>
  <K extends keyof Row & string>(keys: readonly K[]): K[] => [...keys];

/**
 * Builds a manifest `preview` block with `fieldKey` constrained to a list-row property name.
 *
 * @typeParam Row - Record representing the JSON object shape of one list item from the domain API.
 * @param fieldKey - Form/list field to preview (must match a key on `Row`).
 * @returns Preview metadata for the dashboard manifest.
 */
export const previewFieldFor =
  <Row extends Record<string, unknown>>() =>
  <K extends keyof Row & string>(
    fieldKey: K,
  ): { enabled: true; fieldKey: K } => ({
    enabled: true,
    fieldKey,
  });
