import type {
  ArticleEvidence,
  MarketRelations,
  OrganonIngestionClient,
  WrittenLink,
} from "@mediapulse/knowledge-graph";
import type { AgentDataApiClient } from "@workspace/agent-data-api-client";
import {
  ORGANON_INGESTION_EVIDENCE_CHECKS_MAX,
  type OrganonIngestionSentArticle,
} from "@workspace/agent-data-api-contract";
import { pMap } from "@workspace/agent-ingestion";
import {
  type ListedCompanyValueWithoutPoint,
  listedCompanyValuesWithoutPoint,
  marketLinksOf,
} from "./listed-company-values-without-point.js";
import { chunked } from "./chunked.js";
import { spanIsInText } from "./span-is-in-text.js";

export const MAX_EVIDENCE_EXAMPLES = 5;

const UNFINISHED_JOB_STATUSES = new Set(["queued", "running", "ready"]);

type Tally<Example> = { count: number; examples: Example[] };

export type EvidenceCheckResult = {
  sends: number;
  checked: number;
  marked: number;
  skipped: { unfinished: number; failed: number; jobNotFound: number };
  quotesUnchecked: number;
  valuesUnchecked: number;
  withoutPoints: Tally<{ canonicalUrl: string }>;
  quotesNotInText: Tally<{ canonicalUrl: string; quote: string }>;
  figuresWithoutPoint: Tally<{
    canonicalUrl: string;
    figure: string;
  }>;
  pointsMissingTicker: Tally<{
    canonicalUrl: string;
    point: string;
    missingTickerSymbols: string[];
  }>;
  pointsUnderUnplacedTicker: Tally<{
    canonicalUrl: string;
    point: string;
    extraTickerSymbols: string[];
  }>;
  listedCompanyValuesWithoutPoint: Tally<
    { canonicalUrl: string } & ListedCompanyValueWithoutPoint
  >;
  figuresInOtherCurrency: Tally<{
    canonicalUrl: string;
    figure: string;
    currency: string;
  }>;
  partialJobs: Tally<{ canonicalUrl: string }>;
  errors: Tally<{ canonicalUrl: string; message: string }>;
};

const emptyTally = <Example>(): Tally<Example> => ({ count: 0, examples: [] });

const note = <Example>(tally: Tally<Example>, example: Example): void => {
  tally.count += 1;
  if (tally.examples.length < MAX_EVIDENCE_EXAMPLES) {
    tally.examples.push(example);
  }
};

const sentText = (send: OrganonIngestionSentArticle): string | null => {
  if (send.content === null || send.content.trim() === "") {
    return null;
  }

  return [send.title, send.description, send.content]
    .filter((part): part is string => part !== null && part.trim() !== "")
    .join("\n\n");
};

const recordProblems = (
  result: EvidenceCheckResult,
  send: OrganonIngestionSentArticle,
  evidence: ArticleEvidence,
  unsupportedValues: readonly ListedCompanyValueWithoutPoint[],
): void => {
  const { canonicalUrl } = send;
  if (evidence.points.length === 0) {
    note(result.withoutPoints, { canonicalUrl });
  }

  const text = sentText(send);
  if (text === null) {
    result.quotesUnchecked += 1;
  }
  const placedTickerSymbols = new Set(send.tickerSymbols);
  for (const point of evidence.points) {
    if (
      text !== null &&
      point.quote !== null &&
      !spanIsInText(text, point.quote)
    ) {
      note(result.quotesNotInText, { canonicalUrl, quote: point.quote });
    }
    const filedUnder = new Set(point.tickerSymbols);
    const missingTickerSymbols = send.tickerSymbols.filter(
      (symbol) => !filedUnder.has(symbol),
    );
    if (missingTickerSymbols.length > 0) {
      note(result.pointsMissingTicker, {
        canonicalUrl,
        point: point.iri,
        missingTickerSymbols,
      });
    }
    const extraTickerSymbols = point.tickerSymbols.filter(
      (symbol) => !placedTickerSymbols.has(symbol),
    );
    if (extraTickerSymbols.length > 0) {
      note(result.pointsUnderUnplacedTicker, {
        canonicalUrl,
        point: point.iri,
        extraTickerSymbols,
      });
    }
  }

  for (const figure of evidence.figuresWithoutPoint) {
    note(result.figuresWithoutPoint, {
      canonicalUrl,
      figure: figure.label ?? figure.iri,
    });
  }

  for (const figure of evidence.figuresInCurrency) {
    note(result.figuresInOtherCurrency, {
      canonicalUrl,
      figure: figure.label ?? figure.iri,
      currency: figure.currency,
    });
  }

  for (const value of unsupportedValues) {
    note(result.listedCompanyValuesWithoutPoint, { canonicalUrl, ...value });
  }
};

const unsupportedValuesOf = async ({
  organon,
  relations,
  writtenLinks,
  evidence,
}: {
  organon: Pick<OrganonIngestionClient, "listedCompaniesAmong">;
  relations: MarketRelations;
  writtenLinks: readonly WrittenLink[];
  evidence: ArticleEvidence;
}): Promise<ListedCompanyValueWithoutPoint[]> => {
  const links = marketLinksOf(writtenLinks, relations);
  if (links.length === 0) {
    return [];
  }
  const listedCompanies = await organon.listedCompaniesAmong(
    links.flatMap((link) => [link.subject, link.object]),
  );

  return listedCompanyValuesWithoutPoint({
    links,
    points: evidence.points,
    relations,
    listedCompanies,
  });
};

export const checkEvidence = async ({
  organon,
  dataApi,
  sentAfter,
  sentBefore,
  take,
  concurrency,
}: {
  organon: Pick<
    OrganonIngestionClient,
    "getJob" | "articleEvidence" | "marketRelations" | "listedCompaniesAmong"
  >;
  dataApi: Pick<
    AgentDataApiClient,
    "organonIngestionSends" | "organonIngestionEvidenceChecks"
  >;
  sentAfter: Date;
  sentBefore: Date;
  take: number;
  concurrency: number;
}): Promise<EvidenceCheckResult> => {
  const { sends } = await dataApi.organonIngestionSends.get({
    sentAfter: sentAfter.toISOString(),
    sentBefore: sentBefore.toISOString(),
    take,
    unchecked: true,
  });
  const result: EvidenceCheckResult = {
    sends: sends.length,
    checked: 0,
    marked: 0,
    skipped: { unfinished: 0, failed: 0, jobNotFound: 0 },
    quotesUnchecked: 0,
    valuesUnchecked: 0,
    withoutPoints: emptyTally(),
    quotesNotInText: emptyTally(),
    figuresWithoutPoint: emptyTally(),
    pointsMissingTicker: emptyTally(),
    pointsUnderUnplacedTicker: emptyTally(),
    listedCompanyValuesWithoutPoint: emptyTally(),
    figuresInOtherCurrency: emptyTally(),
    partialJobs: emptyTally(),
    errors: emptyTally(),
  };
  if (sends.length === 0) {
    return result;
  }
  const relations = await organon.marketRelations();
  const finishedJobIds: string[] = [];

  await pMap(
    sends,
    async (send) => {
      try {
        const job = await organon.getJob(send.organonJobId);
        if (job === null) {
          result.skipped.jobNotFound += 1;
          finishedJobIds.push(send.organonJobId);
          return;
        }
        if (UNFINISHED_JOB_STATUSES.has(job.status)) {
          result.skipped.unfinished += 1;
          return;
        }
        if (job.status !== "completed") {
          result.skipped.failed += 1;
          finishedJobIds.push(send.organonJobId);
          return;
        }
        const evidence = await organon.articleEvidence(send.canonicalUrl);
        if (job.writtenLinks === null) {
          result.valuesUnchecked += 1;
        }
        if (job.isPartial) {
          note(result.partialJobs, { canonicalUrl: send.canonicalUrl });
        }
        const unsupportedValues = await unsupportedValuesOf({
          organon,
          relations,
          writtenLinks: job.writtenLinks ?? [],
          evidence,
        });
        result.checked += 1;
        recordProblems(result, send, evidence, unsupportedValues);
        finishedJobIds.push(send.organonJobId);
      } catch (error) {
        note(result.errors, {
          canonicalUrl: send.canonicalUrl,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    { concurrency },
  );

  for (const organonJobIds of chunked(
    finishedJobIds,
    ORGANON_INGESTION_EVIDENCE_CHECKS_MAX,
  )) {
    const { checkedJobIds } =
      await dataApi.organonIngestionEvidenceChecks.create({ organonJobIds });
    result.marked += checkedJobIds.length;
  }

  return result;
};
