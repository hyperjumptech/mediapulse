/**
 * Build one ticker's knowledge base from its profile and its articles, locally.
 *
 * Does exactly what the knowledge-ingestion agent does: reads each article with the extraction
 * module and writes every result through agent-data-api. It exists only because local Hermes carries
 * no `AI_MODEL` variable to hand the agent its credentials, so the agent cannot be invoked here.
 *
 * Needs agent-data-api on :8081 and agent-auth-api on :8080.
 *
 * Run from the monorepo root:
 * `OPENROUTER_API_KEY=... pnpm spike:fore-kb -- --symbol FORE --limit 30 --apply`
 */

import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractEntityRelations } from "../apps/mediapulse/agents/knowledge-ingestion/src/lib/extract-entity-relations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(__dirname, "../packages/mediapulse/env/.env") });

const EXTRACTION_CONCURRENCY = 4;

const flagValue = (name) => {
  const prefixed = `--${name}`;
  const index = process.argv.indexOf(prefixed);
  if (index !== -1) {
    return process.argv[index + 1];
  }

  return process.argv
    .find((argument) => argument.startsWith(`${prefixed}=`))
    ?.slice(prefixed.length + 1);
};

const requireEnv = (name) => {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required to run extraction`);
  }

  return value;
};

const mapWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      for (;;) {
        const index = next;
        next += 1;
        const item = items[index];
        if (item === undefined) {
          return;
        }
        results[index] = await worker(item, index);
      }
    })(),
  );
  await Promise.all(runners);

  return results;
};

const mintToken = async () => {
  const response = await fetch(
    `${requireEnv("AGENT_AUTH_API_URL")}/api/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("DOMAIN_INTEGRATION_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Could not mint an agent token (${String(response.status)}). Is agent-auth-api running?`,
    );
  }
  const body = await response.json();

  return body.token;
};

const dataApi = (token) => {
  const baseUrl = `${requireEnv("AGENT_DATA_API_URL")}/api/v1`;
  const call = async (method, pathAndQuery, body) => {
    const response = await fetch(`${baseUrl}${pathAndQuery}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `${method} ${pathAndQuery} failed (${String(response.status)}): ${text.slice(0, 200)}`,
      );
    }

    return text === "" ? null : JSON.parse(text);
  };

  return {
    candidates: (tickerId, take) =>
      call(
        "GET",
        `/knowledge/extraction-candidates?tickerId=${tickerId}&fromStart=true&take=${String(take)}`,
      ),
    seed: (tickerId, extractionRunId) =>
      call("POST", "/knowledge/extraction-seed", { tickerId, extractionRunId }),
    startRun: (tickerId, startedAt) =>
      call("POST", "/knowledge/extraction-runs", {
        tickerId,
        scheduleExecutionId: null,
        agentVersion: "local-script",
        startedAt,
      }),
    apply: (payload) => call("POST", "/knowledge/extractions", payload),
    finishRun: (payload) =>
      call("POST", "/knowledge/extraction-runs/finish", payload),
  };
};

const main = async () => {
  const tickerId = flagValue("ticker-id");
  const limitFlag = flagValue("limit");
  const limit =
    process.argv.includes("--all") || limitFlag === undefined
      ? 500
      : Number.parseInt(limitFlag, 10);
  const apply = process.argv.includes("--apply");
  // Seeds the registry and the profile's parties without calling a model, so the write path and the
  // Hermes graph can be exercised before any tokens are spent.
  const seedOnly = process.argv.includes("--seed-only");

  if (tickerId === undefined) {
    throw new Error(
      "Pass --ticker-id <uuid>. Find it in Hermes under Tickers, or in the knowledge-base list.",
    );
  }

  const api = dataApi(await mintToken());
  const candidates = await api.candidates(tickerId, limit);

  console.log(
    `${candidates.issuer.symbol}: ${String(candidates.parties.length)} parties on file, ${String(candidates.articles.length)} unread articles.`,
  );

  if (!apply) {
    console.log("Dry run. Pass --apply to write.");

    return;
  }

  const apiKey = seedOnly ? "" : requireEnv("OPENROUTER_API_KEY");
  const model = process.env.EVAL_MODEL ?? "openai/gpt-4o-mini";
  const baseUrl =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  const startedAt = new Date();
  const { extractionRunId } = await api.startRun(
    tickerId,
    startedAt.toISOString(),
  );

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
  };

  const seeded = await api.seed(tickerId, extractionRunId);
  tally.entitiesCreated += seeded.entitiesCreated;
  tally.relationsOpened += seeded.relationsOpened;
  tally.relationsConfirmed += seeded.relationsConfirmed;

  const failures = [];

  if (!seedOnly) {
    const outcomes = await mapWithConcurrency(
      candidates.articles,
      EXTRACTION_CONCURRENCY,
      async (article) => {
        try {
          const outcome = await extractEntityRelations({
            article: {
              title: article.title,
              description: article.description,
              content: article.content,
            },
            issuer: candidates.issuer,
            candidates: candidates.parties,
            relationKindLabels: candidates.relationKindLabels,
            llm: { model, apiKey, baseUrl },
          });

          return { article, outcome, error: null };
        } catch (error) {
          return { article, outcome: null, error };
        }
      },
    );

    for (const { article, outcome, error } of outcomes) {
      tally.considered += 1;
      if (error !== null) {
        failures.push({
          id: article.dataSourceId,
          message: String(error).slice(0, 160),
        });

        continue;
      }
      if (!outcome.modelCalled) {
        tally.skippedNoCandidates += 1;

        continue;
      }

      try {
        const written = await api.apply({
          tickerId,
          dataSourceId: article.dataSourceId,
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
        for (const rejection of [...outcome.rejections, ...written.rejected]) {
          if (rejection.reason === "span-not-in-text") {
            tally.rejectedSpanNotInText += 1;
          }
          if (rejection.reason === "name-not-in-text") {
            tally.rejectedNameNotInText += 1;
          }
        }
      } catch (error) {
        failures.push({
          id: article.dataSourceId,
          message: String(error).slice(0, 160),
        });
      }
    }
  }

  const completedAt = new Date();
  await api.finishRun({
    extractionRunId,
    status: failures.length === 0 ? "success" : "partial_success",
    completedAt: completedAt.toISOString(),
    watermarkAt: candidates.watermark,
    ...tally,
    stopReason:
      failures.length === 0
        ? null
        : `${String(failures.length)} of ${String(tally.considered)} articles failed: ${failures
            .slice(0, 3)
            .map((failure) => `${failure.id}: ${failure.message}`)
            .join("; ")}`,
    durationMs: completedAt.getTime() - startedAt.getTime(),
  });

  console.log(`Run ${extractionRunId}:`, tally);
  if (failures.length > 0) {
    console.log(
      `${String(failures.length)} articles failed:`,
      failures.slice(0, 3),
    );
  }
};

main().catch((error) => {
  console.error("Extraction failed", error);
  process.exit(1);
});
