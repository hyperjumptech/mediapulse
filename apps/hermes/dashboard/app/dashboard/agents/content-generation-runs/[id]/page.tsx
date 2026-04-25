/** @vitest-environment node */

import { notFound } from "next/navigation";
import { env } from "@hermes/env";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getDashboardAgentDataApiClient } from "@/lib/agent-data-api-client";

import { ContentGenerationRunDetail } from "./content-generation-run-detail";

/**
 * Detail page for a single content-generation run.
 * Fetches the run data via the SDK (since there is no single-resource GET endpoint,
 * this page calls the list endpoint with cursor=id and limit=1).
 * Gated by the HERMES_CGA_DIAGNOSTICS_ENABLED feature flag.
 */
const ContentGenerationRunDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) => {
  if (env.HERMES_CGA_DIAGNOSTICS_ENABLED !== "true") {
    notFound();
  }

  const { id } = await Promise.resolve(params);
  const client = getDashboardAgentDataApiClient();

  let run;

  try {
    const result = await client.contentGenerationRuns.get({
      cursor: id,
      limit: 1,
    });
    const found = result.data.find((r) => r.id === id);
    if (!found) {
      notFound();
    }
    run = found;
  } catch {
    notFound();
  }

  return <ContentGenerationRunDetail run={run} />;
};

export default withAuthProtection(ContentGenerationRunDetailPage);
