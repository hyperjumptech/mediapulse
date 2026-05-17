import { useEffect } from "react";

import { applyRequiredDefaults, getSchemaFormType } from "./schema-form-utils";
import type { JsonSchema } from "./types";

/**
 * Seeds parent value with required schema keys when missing (including nested required keys).
 */
export const useSchemaFormSeed = (
  schema: JsonSchema,
  value: Record<string, unknown>,
  onChange: (v: Record<string, unknown>) => void,
): void => {
  const type = getSchemaFormType(schema);
  useEffect(() => {
    if (type !== "object" || !schema.properties || !schema.required?.length) {
      return;
    }
    const merged = applyRequiredDefaults(schema, value);
    if (merged !== value) onChange(merged);
  }, [schema, type, value, onChange]);
};
