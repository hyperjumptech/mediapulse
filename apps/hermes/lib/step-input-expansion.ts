/**
 * Wiring layer for **step input expansion** (e.g. `db:table:field` strings): generic
 * syntax/validation comes from `@workspace/hermes-step-input-syntax`; Mediapulse
 * execution from `@workspace/mediapulse-hermes-integration`; DB clients from
 * `@workspace/mediapulse-database`.
 */
import { env } from "@workspace/env";
import { expandSingleDataSource } from "@workspace/mediapulse-hermes-integration";
import {
  MAX_TAKE,
  parseDataSourceString,
  validateDataSourceExpressions as validateDataSourceExpressionsBase,
  type ValidateDataSourceExpressionsResult,
} from "@workspace/hermes-step-input-syntax";

export { PrismaClientWithSchema } from "@workspace/mediapulse-database/client";
export { prisma as mediapulsePrisma } from "@workspace/mediapulse-database";
export { expandSingleDataSource };
export type { ValidateDataSourceExpressionsResult };
export { parseDataSourceString };

/**
 * Validates `db:` expressions using the same max take/limit as runtime expansion
 * (`HERMES_DATA_SOURCE_MAX_TAKE` from `@workspace/env`).
 *
 * @param params - Params that may contain data source strings.
 * @returns Whether all expressions are syntactically valid and within bounds.
 */
export const validateDataSourceExpressions = (
  params: Record<string, unknown>,
): ValidateDataSourceExpressionsResult =>
  validateDataSourceExpressionsBase(params, {
    maxTake: env.HERMES_DATA_SOURCE_MAX_TAKE ?? MAX_TAKE,
  });
