import { MAX_TAKE } from "./constants";
import { parseDataSourceString } from "./data-source-string";

export type ValidateDataSourceExpressionsResult =
  | { valid: true }
  | { valid: false; errors: string[] };

export type ValidateDataSourceExpressionsOptions = {
  /**
   * Upper bound for `take` / `limit` in parsed strings (default {@link MAX_TAKE}).
   * Hermes / worker should pass the same value used for runtime expansion.
   */
  maxTake?: number;
};

/**
 * Validates `db:` step-input expressions in a params object.
 * Checks parse success and that take/limit are within `[0, maxTake]`.
 *
 * @param params - Params where values may be data source strings.
 * @param options - Optional bounds (defaults match expansion defaults).
 * @returns Validation result with errors if any expression is invalid.
 */
export const validateDataSourceExpressions = (
  params: Record<string, unknown>,
  options?: ValidateDataSourceExpressionsOptions,
): ValidateDataSourceExpressionsResult => {
  const maxTake = options?.maxTake ?? MAX_TAKE;
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
      } else if (parsed.take > maxTake) {
        errors.push(
          `Param "${key}": take/limit ${parsed.take} exceeds max ${maxTake}`,
        );
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
};
