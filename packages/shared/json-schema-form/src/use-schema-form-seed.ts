import { useEffect } from "react";

import { applySchemaDefaults, getSchemaFormType } from "./schema-form-utils";
import type { JsonSchema } from "./types";

/**
 * Seeds parent value with schema defaults and required keys when missing (including nested keys).
 */
export const useSchemaFormSeed = (
  schema: JsonSchema,
  value: Record<string, unknown>,
  onChange: (v: Record<string, unknown>) => void,
): void => {
  const type = getSchemaFormType(schema);
  useEffect(() => {
    if (type !== "object" || !schema.properties) {
      return;
    }
    const merged = applySchemaDefaults(schema, value);
    if (merged !== value) onChange(merged);
  }, [schema, type, value, onChange]);
};
