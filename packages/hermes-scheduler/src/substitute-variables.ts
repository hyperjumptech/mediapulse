/** Regex to match {{VAR_KEY}} placeholders (captures the key). */
const PLACEHOLDER_REGEX = /\{\{([^{}]+)\}\}/g;

/**
 * Replaces all {{KEY}} placeholders in a string with values from the variables map.
 * Unknown keys are left as-is (placeholder unchanged).
 *
 * @param str - String that may contain {{VAR_KEY}} placeholders.
 * @param variables - Map of variable key to value.
 * @returns String with placeholders replaced.
 */
export const substituteInString = (
  str: string,
  variables: Map<string, string>,
): string => {
  return str.replace(PLACEHOLDER_REGEX, (_, key) => {
    const trimmed = key.trim();
    const value = variables.get(trimmed);
    return value !== undefined ? value : `{{${trimmed}}}`;
  });
};

/**
 * Recursively walks objects and arrays and replaces {{KEY}} placeholders in every string value.
 * Non-string primitives and null/undefined are returned unchanged.
 *
 * @param obj - Object, array, or primitive (strings get substitution).
 * @param variables - Map of variable key to value.
 * @returns Deep copy with string values substituted.
 */
export const substituteVariables = <T>(
  obj: T,
  variables: Map<string, string>,
): T => {
  if (typeof obj === "string") {
    return substituteInString(obj, variables) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => substituteVariables(item, variables)) as T;
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = substituteVariables(v, variables);
    }
    return result as T;
  }
  return obj;
};
