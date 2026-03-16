import { parseDataSourceString } from "./data-source-string";
import { MAX_TAKE } from "./expand-data-sources";

export type ValidateDataSourceExpressionsResult =
  | { valid: true }
  | { valid: false; errors: string[] };

/**
 * Validates data source expressions in schedule params.
 * Checks parse success and that take/limit are within bounds (0 to MAX_TAKE).
 *
 * @param params - Schedule params (values may be data source strings).
 * @returns Validation result with errors if any expression is invalid.
 */
export const validateDataSourceExpressions = (
  params: Record<string, unknown>,
): ValidateDataSourceExpressionsResult => {
  const errors: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== "string" || !value.startsWith("db:")) continue;

    const parsed = parseDataSourceString(value);
    if (!parsed) {
      errors.push(
        `Param "${key}": invalid data source format. Expected db:table:field?options`,
      );
      continue;
    }

    if (parsed.take != null) {
      if (parsed.take < 0) {
        errors.push(`Param "${key}": take/limit must be non-negative`);
      } else if (parsed.take > MAX_TAKE) {
        errors.push(
          `Param "${key}": take/limit ${parsed.take} exceeds max ${MAX_TAKE}`,
        );
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
};
