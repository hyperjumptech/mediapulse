import { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { logger } from "@workspace/logger";
import { env } from "@mediapulse/env/agents-knowledge-ingestion";

import { Input, Config } from "./index.js";
import { AGENT_VERSION } from "./agent-version.js";
import { chunked } from "./lib/chunked.js";
import { extractEntityRelations } from "./lib/extract-entity-relations.js";
import { createKnowledgeStore } from "./lib/store.js";

const FAILURE_SAMPLE_LIMIT = 3;

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
  const store = createKnowledgeStore(client);

  const candidates = await store.candidates({
    tickerId: input.tickerId,
    since: input.since,
    fromStart: input.fromStart ?? false,
    take: input.limit,
  });

  const dryRun = config.dryRun ?? false;
  const { extractionRunId } = dryRun
    ? { extractionRunId: null }
    : await client.knowledgeExtractionRuns.create({
        tickerId: input.tickerId,
        scheduleExecutionId: hermesCorrelation?.scheduleExecutionId ?? null,
        agentVersion: AGENT_VERSION,
        startedAt: startedAt.toISOString(),
      });

  const tally = {
    considered: 0,
    skippedNoCandidates: 0,
    entitiesCreated: 0,
    relationsOpened: 0,
    relationsConfirmed: 0,
    mentionsWritten: 0,
    kindsCreated: 0,
    rejectedSpanNotInText: 0,
    rejectedNameNotInText: 0,
    rejectedPerson: 0,
  };
  const failures: { dataSourceId: string; message: string }[] = [];

  try {
    if (!dryRun) {
      const seeded = await store.seedFromProfile({
        tickerId: input.tickerId,
        extractionRunId,
      });
      tally.entitiesCreated += seeded.entitiesCreated;
      tally.relationsOpened += seeded.relationsOpened;
      tally.relationsConfirmed += seeded.relationsConfirmed;
    }

    // Articles are read in parallel and applied in order, a chunk at a time.
    //
    // Reading is the slow half: a production article takes around 34 seconds, so 100 read one at a
    // time outlive the invoke-agent job timeout. Applying stays sequential, because resolving an
    // entity is find-then-create and two articles naming the same new party at once would race for
    // its unique key. Chunking keeps writes landing as the run proceeds, so a run cut short still
    // keeps what it had read.
    for (const chunk of chunked(candidates.articles, config.readConcurrency)) {
      const readings = await Promise.all(
        chunk.map(async (article) => {
          try {
            const outcome = await extractEntityRelations({
              article: {
                title: article.title,
                description: article.description,
                content: article.content,
              },
              issuer: {
                symbol: candidates.issuer.symbol,
                name: candidates.issuer.name,
                aliases: candidates.issuer.aliases,
                companyOverview: candidates.issuer.companyOverview,
              },
              candidates: candidates.parties.map((party) => ({
                name: party.name,
                aliases: party.aliases,
                kind: party.kind === "regulator" ? "regulator" : "company",
              })),
              relationKindLabels: candidates.relationKindLabels,
              llm: {
                model: config.model,
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
              },
            });

            return { article, outcome, message: null as string | null };
          } catch (error) {
            return {
              article,
              outcome: null,
              message: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      for (const reading of readings) {
        tally.considered += 1;

        if (reading.message !== null) {
          failures.push({
            dataSourceId: reading.article.dataSourceId,
            message: reading.message,
          });

          continue;
        }
        const outcome = reading.outcome;
        if (outcome === null) {
          continue;
        }
        if (!outcome.modelCalled) {
          tally.skippedNoCandidates += 1;

          continue;
        }
        for (const rejection of outcome.rejections) {
          if (rejection.reason === "span-not-in-text") {
            tally.rejectedSpanNotInText += 1;
          }
          if (rejection.reason === "name-not-in-text") {
            tally.rejectedNameNotInText += 1;
          }
          if (rejection.reason === "person") {
            tally.rejectedPerson += 1;
          }
        }
        if (dryRun) {
          continue;
        }

        try {
          const written = await store.apply({
            tickerId: input.tickerId,
            dataSourceId: reading.article.dataSourceId,
            extractionRunId,
            entities: outcome.entities,
            relations: outcome.relations.map((relation) => ({
              subject: relation.subject,
              kind: relation.kind,
              object: relation.object,
              evidenceSpan: relation.evidenceSpan,
            })),
          });
          tally.entitiesCreated += written.entitiesCreated;
          tally.mentionsWritten += written.mentionsWritten;
          tally.relationsOpened += written.relationsOpened;
          tally.relationsConfirmed += written.relationsConfirmed;
          tally.kindsCreated += written.kindsCreated;
          // The server re-runs every guard, so a claim it refused is counted here too.
          for (const rejection of written.rejected) {
            if (rejection.reason === "span-not-in-text") {
              tally.rejectedSpanNotInText += 1;
            }
            if (rejection.reason === "name-not-in-text") {
              tally.rejectedNameNotInText += 1;
            }
            if (rejection.reason === "person") {
              tally.rejectedPerson += 1;
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          failures.push({
            dataSourceId: reading.article.dataSourceId,
            message,
          });
        }
      }
    }

    const completedAt = new Date();
    const stopReason =
      failures.length === 0
        ? null
        : `${failures.length} of ${tally.considered} articles failed: ${failures
            .slice(0, FAILURE_SAMPLE_LIMIT)
            .map((failure) => `${failure.dataSourceId}: ${failure.message}`)
            .join("; ")}`;

    if (extractionRunId !== null) {
      await client.knowledgeExtractionRunsFinish.create({
        extractionRunId,
        status: failures.length === 0 ? "success" : "partial_success",
        completedAt: completedAt.toISOString(),
        watermarkAt: candidates.watermark,
        ...tally,
        stopReason,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      });
    }

    if (failures.length > 0) {
      logger.warn(
        { failures, tickerId: input.tickerId },
        "--> knowledge-ingestion skipped articles that failed",
      );
    }

    logger.info(
      { ...tally, failed: failures.length, watermark: candidates.watermark },
      "--> knowledge-ingestion complete",
    );

    return {
      success: true,
      message: `Read ${String(tally.considered)} articles for ${candidates.issuer.symbol}`,
      details: {
        ...tally,
        failed: failures.length,
        watermark: candidates.watermark,
        resumedFrom: candidates.resumedFrom,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (extractionRunId !== null) {
      await client.knowledgeExtractionRunsFinish.create({
        extractionRunId,
        status: "failed",
        completedAt: new Date().toISOString(),
        watermarkAt: null,
        ...tally,
        stopReason: message,
        durationMs: Date.now() - startedAt.getTime(),
      });
    }

    throw error;
  }
};
