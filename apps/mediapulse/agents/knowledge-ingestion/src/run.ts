import { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { logger } from "@workspace/logger";
import { env } from "@mediapulse/env/agents-knowledge-ingestion";

import { Input, Config } from "./index.js";
import { AGENT_VERSION } from "./agent-version.js";
import { ingestCandidates, type IngestCandidate } from "./lib/ingest.js";
import { createKnowledgeStore } from "./lib/store.js";

export const run = async ({
  input,
  config,
  token,
  hermesCorrelation,
}: AgentRunContext<Input, Config>): Promise<AgentRunResult> => {
  const startedAt = new Date();
  const client = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  const { sources, watermark, resumedFrom } =
    await client.knowledgeCandidateSources.get({
      since: input.since,
      fromStart: input.fromStart ?? false,
      take: input.limit ?? 500,
    });

  if (sources.length === 0) {
    return {
      success: true,
      message: "No new sources to ingest",
      details: { considered: 0, watermark, resumedFrom },
    };
  }

  const dryRun = config.dryRun ?? false;
  const { ingestionRunId } = dryRun
    ? { ingestionRunId: null }
    : await client.knowledgeIngestionRuns.create({
        scheduleExecutionId: hermesCorrelation?.scheduleExecutionId ?? null,
        agentVersion: AGENT_VERSION,
        startedAt: startedAt.toISOString(),
      });

  const candidates: IngestCandidate[] = sources.map((source) => ({
    dataSourceId: source.dataSourceId,
    title: source.title,
    text: source.text,
    observedAt: source.observedAt,
    publishedDay: source.publishedDay ?? undefined,
    tickerIds: source.tickerIds,
  }));

  try {
    const tally = await ingestCandidates(
      candidates,
      createKnowledgeStore(client, ingestionRunId),
    );
    const completedAt = new Date();

    if (ingestionRunId !== null) {
      await client.knowledgeIngestionRunsFinish.create({
        ingestionRunId,
        status: "success",
        completedAt: completedAt.toISOString(),
        watermarkAt: watermark,
        ...tally,
        stopReason: null,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      });
    }

    logger.info(
      { ...tally, watermark, resumedFrom },
      "--> knowledge-ingestion complete",
    );

    return {
      success: true,
      message: `Ingested ${tally.considered} sources`,
      details: { ...tally, watermark, resumedFrom },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (ingestionRunId !== null) {
      await client.knowledgeIngestionRunsFinish.create({
        ingestionRunId,
        status: "failed",
        completedAt: new Date().toISOString(),
        watermarkAt: null,
        considered: candidates.length,
        storylinesOpened: 0,
        developmentsOpened: 0,
        citationsAdded: 0,
        storylinesLocked: 0,
        skippedNoAnchors: 0,
        stopReason: message,
        durationMs: null,
      });
    }

    return { success: false, message, details: { watermark, resumedFrom } };
  }
};
