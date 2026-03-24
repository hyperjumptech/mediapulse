import { createDomainIntegrationClient } from "@hermes/domain-contract";
import { DomainIntegrationStatus } from "@hermes/orchestration-database";
import { env } from "@hermes/env";
import { DEFAULT_TAKE, MAX_TAKE } from "@hermes/step-input-syntax";
import type { ExpandStepInputs } from "@hermes/scheduler";

import { getBearerJwtForDomainIntegrationId } from "./domain-integration-auth-token";

/**
 * Builds {@link ExpandStepInputs} for dashboard “Run pipeline”: resolves `db:` data-source expansion
 * and aliases via domain-api, matching scheduled runs in hermes-worker.
 *
 * Uses {@link ExpandStepInputsContext.orchDb} for domain lookups and JWT minting so injected DBs in tests behave correctly.
 *
 * @returns Expansion callback for {@link planPipelineInvocations}.
 */
export const createExpandStepInputsForManualPipelineRun =
  (): ExpandStepInputs => {
    const defaultTake = DEFAULT_TAKE;
    const maxTake = env.HERMES_DATA_SOURCE_MAX_TAKE ?? MAX_TAKE;

    return async (context) => {
      const db = context.orchDb;
      const integration = await db.domainIntegration.findFirst({
        where: {
          id: context.domainIntegrationId,
          status: DomainIntegrationStatus.active,
        },
        select: { baseUrl: true },
      });
      const baseUrl = integration?.baseUrl?.trim();
      if (!baseUrl) {
        throw new Error(
          "Domain integration has no base URL; register domain-api with Hermes before running pipelines that need step-input expansion.",
        );
      }
      const authToken = await getBearerJwtForDomainIntegrationId(
        context.domainIntegrationId,
        { db },
      );
      const domainClient = createDomainIntegrationClient({
        baseUrl,
        ...(authToken !== undefined ? { authToken } : {}),
      });
      const response = await domainClient.expandStepInputs({
        input: context.input,
        defaultTake,
        maxTake,
      });
      return response.expandedInputs;
    };
  };
