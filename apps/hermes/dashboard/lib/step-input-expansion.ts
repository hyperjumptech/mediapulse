import { env } from "@hermes/env";
import { createDomainIntegrationClient } from "@workspace/hermes-domain-contract";
import {
  MAX_TAKE,
  parseDataSourceString,
  validateDataSourceExpressions as validateDataSourceExpressionsBase,
  type ValidateDataSourceExpressionsResult,
} from "@workspace/hermes-step-input-syntax";
import { getDefaultDomainIntegration } from "./domain-integrations";

export type { ValidateDataSourceExpressionsResult };
export { parseDataSourceString };

/**
 * Resolves a domain integration HTTP client for expansion and preview calls.
 *
 * @returns Domain integration client.
 */
export const getDomainIntegrationClient = async () => {
  const integration = await getDefaultDomainIntegration().catch(() => null);
  const baseUrl = integration?.baseUrl ?? env.MEDIAPULSE_API_URL;
  if (!baseUrl) {
    throw new Error(
      "No active domain integration found and MEDIAPULSE_API_URL is not configured",
    );
  }

  return createDomainIntegrationClient({
    baseUrl,
    authToken: env.DOMAIN_INTEGRATION_AUTH_TOKEN,
  });
};

/**
 * Validates `db:` expressions using the same max take/limit as runtime expansion
 * (`HERMES_DATA_SOURCE_MAX_TAKE` from `@hermes/env`).
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
