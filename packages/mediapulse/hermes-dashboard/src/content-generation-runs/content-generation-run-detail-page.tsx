/** @vitest-environment node */

import { notFound } from "next/navigation";

import type { MediapulseHermesDashboardRuntimeConfig } from "../config";
import { getContentGenerationRunById } from "../lib/content-generation-runs-api";

import { ContentGenerationRunDetail } from "./[id]/content-generation-run-detail";

type ContentGenerationRunDetailPageViewProps = {
  runId: string;
  config: MediapulseHermesDashboardRuntimeConfig;
};

/**
 * Detail view for a single content-generation run.
 */
export const ContentGenerationRunDetailPageView = async ({
  runId,
  config,
}: ContentGenerationRunDetailPageViewProps) => {
  if (!config.cgaDiagnosticsEnabled) {
    notFound();
  }

  const run = await getContentGenerationRunById(runId, config).catch(
    () => null,
  );
  if (!run) {
    notFound();
  }

  return <ContentGenerationRunDetail run={run} />;
};
