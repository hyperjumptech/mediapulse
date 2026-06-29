/**
 * Converts Zod write-body schemas into JSON Schema objects for Hermes `table-v1` create/update forms.
 */

import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Humanizes a camelCase API field name into a short title (e.g. `expansionString` → `Expansion string`).
 *
 * @param fieldKey - Object key from the Zod schema.
 * @returns Title suitable for JSON Schema `title`.
 */
export const defaultTitleForFormFieldKey = (fieldKey: string): string => {
  const spaced = fieldKey.replace(/([A-Z])/g, " $1").trim();
  const lower = spaced.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

export type HermesFormJsonSchemaFromZodCollaborators = {
  /**
   * Optional explicit titles per property; overrides {@link defaultTitleForFormFieldKey}.
   *
   * @param fieldKey - Top-level object property name.
   */
  titleForFieldKey?: (fieldKey: string) => string;
};

/**
 * Builds a Hermes-compatible JSON Schema object from a Zod object schema (root `type: "object"`).
 *
 * @param schema - Zod object used for API body validation.
 * @param collaborators - Optional title resolver; defaults to {@link defaultTitleForFormFieldKey}.
 * @returns Plain JSON Schema record for manifest `createSchema` / `updateSchema`.
 */
export const hermesFormJsonSchemaFromZod = (
  schema: z.ZodObject<z.ZodRawShape>,
  collaborators: HermesFormJsonSchemaFromZodCollaborators = {},
): Record<string, unknown> => {
  const raw = zodToJsonSchema(schema, {
    $refStrategy: "none",
    target: "openApi3",
  }) as Record<string, unknown>;

  if (
    raw.type !== "object" ||
    typeof raw.properties !== "object" ||
    raw.properties === null
  ) {
    throw new Error(
      "Expected zodToJsonSchema root to be type object with properties",
    );
  }

  const props = raw.properties as Record<string, Record<string, unknown>>;
  const titleFor =
    collaborators.titleForFieldKey ??
    ((k: string) => defaultTitleForFormFieldKey(k));

  const nextProps: Record<string, unknown> = { ...props };
  for (const key of Object.keys(nextProps)) {
    const sub = { ...(nextProps[key] as Record<string, unknown>) };
    sub.title = titleFor(key);
    nextProps[key] = sub;
  }

  const nextRoot: Record<string, unknown> = { ...raw, properties: nextProps };
  if (Array.isArray(raw.required)) {
    const required = (raw.required as string[]).filter((key) => {
      const prop = nextProps[key] as Record<string, unknown> | undefined;
      return prop?.type !== "boolean";
    });
    nextRoot.required = required;
  }

  return nextRoot;
};

/**
 * Merges extra top-level `properties` entries (or replaces keys) on a Hermes object JSON Schema.
 *
 * @param root - Value from {@link hermesFormJsonSchemaFromZod}.
 * @param propertiesPatch - Shallow merge into `root.properties`.
 * @returns New root object; does not mutate `root`.
 */
export const mergeHermesObjectFormProperties = (
  root: Record<string, unknown>,
  propertiesPatch: Record<string, unknown>,
): Record<string, unknown> => {
  const props =
    typeof root.properties === "object" &&
    root.properties !== null &&
    !Array.isArray(root.properties)
      ? (root.properties as Record<string, unknown>)
      : {};
  return {
    ...root,
    properties: { ...props, ...propertiesPatch },
  };
};
