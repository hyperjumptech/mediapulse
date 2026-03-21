/**
 * Wiring layer for **step input expansion** (e.g. `db:table:field` strings): Hermes
 * code imports from this module instead of `@workspace/mediapulse-*` packages
 * directly. The implementation stays in the integration and Mediapulse database
 * packages; this file is the only composition point in the app.
 */
export { PrismaClientWithSchema } from "@workspace/mediapulse-database/client";
export { prisma as mediapulsePrisma } from "@workspace/mediapulse-database";
export {
  expandSingleDataSource,
  parseDataSourceString,
  validateDataSourceExpressions,
  type ValidateDataSourceExpressionsResult,
} from "@workspace/mediapulse-hermes-integration";
