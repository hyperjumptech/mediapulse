import { env } from "@mediapulse/env/agents-knowledge-ingestion";
import {
  buildIngestionRequest,
  createOrganonIngestionClient,
} from "@mediapulse/knowledge-graph";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { OrganonIngestionCandidate } from "@workspace/agent-data-api-contract";
import { fetchSourceBodies, pMap } from "@workspace/agent-ingestion";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";

import type { OrganonIngestionConfig } from "./config-schema.js";
import {
  checkEvidence,
  type EvidenceCheckResult,
} from "./lib/check-evidence.js";
import { fetchMissingBodies } from "./lib/fetch-missing-bodies.js";
import { createPublisherResolver } from "./lib/publisher-resolver.js";
import { sweepFailedJobs, type SweepResult } from "./lib/sweep-failed-jobs.js";

export type Input = { limit?: number };
export type Config = OrganonIngestionConfig;

export type RunDependencies = {
  createDataApi?: typeof createAgentDataApiClient;
  createIngestionClient?: typeof createOrganonIngestionClient;
  fetchBodies?: typeof fetchSourceBodies;
  now?: () => Date;
};

export const MAX_REPORTED_FAILURES = 10;

const HOUR_MS = 3_600_000;

type SendFailure = { canonicalUrl: string; message: string };

type JobFailure = { canonicalUrl: string; error: string | null };

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const publisherDomainOf = (candidate: OrganonIngestionCandidate): string =>
  candidate.registrableDomain ??
  new URL(candidate.canonicalUrl).hostname.replace(/^www\./, "");

const tickerSymbolsOf = (candidate: OrganonIngestionCandidate): string[] =>
  candidate.tickers.map((ticker) => ticker.symbol);

const placedForIrisOf = (
  candidate: OrganonIngestionCandidate,
  listedCompanyBySymbol: ReadonlyMap<string, string>,
): string[] =>
  tickerSymbolsOf(candidate).flatMap((symbol) => {
    const iri = listedCompanyBySymbol.get(symbol);

    return iri === undefined ? [] : [iri];
  });

export const createRunHandler =
  ({
    createDataApi = createAgentDataApiClient,
    createIngestionClient = createOrganonIngestionClient,
    fetchBodies = fetchSourceBodies,
    now = () => new Date(),
  }: RunDependencies = {}) =>
  async ({
    input,
    config,
    token,
  }: AgentRunContext<Input, Config>): Promise<AgentRunResult> => {
    const startedAt = now();
    const dataApi = createDataApi({
      baseUrl: env.AGENT_DATA_API_URL,
      version: "v1",
      token,
    });
    const take = Math.min(
      input.limit ?? config.maxSendsPerRun,
      config.maxSendsPerRun,
    );
    const { candidates } = await dataApi.organonIngestionCandidates.get({
      sendFrom: new Date(config.sendFrom).toISOString(),
      lookbackDays: config.lookbackDays,
      take,
    });

    if (config.dryRun) {
      return {
        success: true,
        message: `Dry run: ${candidates.length} articles would be sent`,
        details: {
          dryRun: true,
          candidates: candidates.map((candidate) => ({
            canonicalUrl: candidate.canonicalUrl,
            tickers: tickerSymbolsOf(candidate),
            sentTickerSymbols: candidate.sentTickerSymbols,
            hasBody: candidate.content !== null,
          })),
        },
      };
    }

    const organon = createIngestionClient({
      baseUrl: config.organonUrl,
      apiKey: config.organonApiKey,
      timeoutMs: config.requestTimeoutMs,
    });

    const placedSymbols = [...new Set(candidates.flatMap(tickerSymbolsOf))];
    let listedCompanyBySymbol: ReadonlyMap<string, string>;
    try {
      listedCompanyBySymbol =
        await organon.listedCompanyIrisByTicker(placedSymbols);
    } catch (error) {
      logger.error({ err: error }, "Listed company lookup failed");

      return {
        success: false,
        message: `Sent none of ${candidates.length} articles to the knowledge graph: the listed company lookup failed`,
        details: {
          candidates: candidates.length,
          sent: 0,
          tickerLookupError: describeError(error),
        },
      };
    }
    const unknownTickers = placedSymbols.filter(
      (symbol) => !listedCompanyBySymbol.has(symbol),
    );
    if (unknownTickers.length > 0) {
      logger.warn({ unknownTickers }, "Placed tickers with no listed company");
    }

    const bodies = await fetchMissingBodies({
      candidates,
      config: {
        maxFetches: config.maxFetchesPerRun,
        providers: config.fetch.providers,
        deadUrlCache: config.resilience.deadUrlCache,
        hostErrorBreaker: config.resilience.hostErrorBreaker,
      },
      dataApi,
      fetchBodies,
      logger,
    });

    const resolvePublisher = createPublisherResolver(organon);
    const sendable = candidates.filter((candidate) =>
      bodies.bodies.has(candidate.canonicalUrl),
    );
    const failures: SendFailure[] = [];
    const canonicalUrlByJobId = new Map<string, string>();
    let sent = 0;
    const createdPublisherDomains = new Set<string>();
    const failedPublisherDomains = new Set<string>();

    await pMap(
      sendable,
      async (candidate) => {
        try {
          const registrableDomain = publisherDomainOf(candidate);
          const publisher = await resolvePublisher(registrableDomain);
          if (publisher.created) {
            createdPublisherDomains.add(registrableDomain);
          }
          if (
            publisher.error &&
            !failedPublisherDomains.has(registrableDomain)
          ) {
            failedPublisherDomains.add(registrableDomain);
            logger.warn(
              { registrableDomain, err: publisher.error },
              "Sending without a publisher",
            );
          }
          const request = buildIngestionRequest({
            canonicalUrl: candidate.canonicalUrl,
            url: candidate.url,
            title: candidate.title,
            description: candidate.description,
            content: bodies.bodies.get(candidate.canonicalUrl) ?? "",
            publishedAt: candidate.publishedAt,
            registrableDomain,
            publisherIri: publisher.iri,
            placedForIris: placedForIrisOf(candidate, listedCompanyBySymbol),
          });
          const { jobId } = await organon.startIngestion(request);
          canonicalUrlByJobId.set(jobId, candidate.canonicalUrl);
          await dataApi.organonIngestionSends.create([
            {
              canonicalUrl: candidate.canonicalUrl,
              tickerSymbols: tickerSymbolsOf(candidate),
              organonJobId: jobId,
              sentAt: now().toISOString(),
            },
          ]);
          sent += 1;
        } catch (error) {
          failures.push({
            canonicalUrl: candidate.canonicalUrl,
            message: describeError(error),
          });
        }
      },
      { concurrency: config.concurrency },
    );

    let sweep: SweepResult | { error: string };
    let jobFailures: JobFailure[] | null = null;
    try {
      const outcome = await sweepFailedJobs({
        organon,
        dataApi,
        failedBefore: startedAt,
      });
      sweep = outcome.result;
      jobFailures = outcome.failedSinceRunStarted.flatMap((job) => {
        const canonicalUrl = canonicalUrlByJobId.get(job.id);

        return canonicalUrl === undefined
          ? []
          : [{ canonicalUrl, error: job.error }];
      });
    } catch (error) {
      logger.error({ err: error }, "Failed-job sweep failed");
      sweep = { error: describeError(error) };
    }
    if (jobFailures !== null && jobFailures.length > 0) {
      logger.warn(
        { jobsFailed: jobFailures.length, firstError: jobFailures[0]?.error },
        "Jobs from this run already failed",
      );
    }

    let evidence: EvidenceCheckResult | { error: string } | null = null;
    if (config.evidenceCheck.enabled) {
      try {
        evidence = await checkEvidence({
          organon,
          dataApi,
          sentAfter: new Date(
            startedAt.getTime() - config.evidenceCheck.lookbackHours * HOUR_MS,
          ),
          sentBefore: startedAt,
          take: config.evidenceCheck.maxArticles,
          concurrency: config.concurrency,
        });
      } catch (error) {
        logger.error({ err: error }, "Evidence check failed");
        evidence = { error: describeError(error) };
      }
    }

    const noBody =
      candidates.length - sendable.length - bodies.excludedUrls.length;
    const details = {
      candidates: candidates.length,
      fetchAttempted: bodies.fetchAttempted,
      fetched: bodies.fetched,
      excludedHost: bodies.excludedUrls.length,
      noBody,
      sent,
      failed: failures.length,
      jobsFailed: jobFailures?.length ?? null,
      publishersCreated: createdPublisherDomains.size,
      publisherFailures: failedPublisherDomains.size,
      unknownTickers,
      sweep,
      evidence,
      failures: failures.slice(0, MAX_REPORTED_FAILURES),
      jobFailures: (jobFailures ?? []).slice(0, MAX_REPORTED_FAILURES),
    };
    const message = `Sent ${sent} of ${candidates.length} articles to the knowledge graph`;

    if (sendable.length > 0 && sent === 0) {
      return {
        success: false,
        message: `${message}: every send failed`,
        details,
      };
    }

    return { success: true, message, details };
  };

export const run = createRunHandler();
