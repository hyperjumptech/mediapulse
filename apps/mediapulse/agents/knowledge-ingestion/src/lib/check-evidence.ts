import type {
  ArticleEvidence,
  OrganonIngestionClient,
} from "@mediapulse/knowledge-graph";
import type { AgentDataApiClient } from "@workspace/agent-data-api-client";
import type { OrganonIngestionSentArticle } from "@workspace/agent-data-api-contract";
import { pMap } from "@workspace/agent-ingestion";
import { spanIsInText } from "./span-is-in-text.js";

export const MAX_EVIDENCE_EXAMPLES = 5;

const UNFINISHED_JOB_STATUSES = new Set(["queued", "running", "ready"]);

type Tally<Example> = { count: number; examples: Example[] };

export type EvidenceCheckResult = {
  sends: number;
  checked: number;
  skipped: { unfinished: number; failed: number; jobNotFound: number };
  quotesUnchecked: number;
  withoutAnnotations: Tally<{ canonicalUrl: string }>;
  quotesNotInText: Tally<{ canonicalUrl: string; quote: string }>;
  figuresWithoutAnnotation: Tally<{
    canonicalUrl: string;
    figure: string;
  }>;
  annotationsMissingTicker: Tally<{
    canonicalUrl: string;
    annotation: string;
    missingTickerSymbols: string[];
  }>;
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
): void => {
  const { canonicalUrl } = send;
  if (evidence.annotations.length === 0) {
    note(result.withoutAnnotations, { canonicalUrl });
  }

  const text = sentText(send);
  if (text === null) {
    result.quotesUnchecked += 1;
  }
  for (const annotation of evidence.annotations) {
    if (text !== null) {
      for (const quote of annotation.quotes) {
        if (!spanIsInText(text, quote)) {
          note(result.quotesNotInText, { canonicalUrl, quote });
        }
      }
    }
    const filedUnder = new Set(annotation.tickerSymbols);
    const missingTickerSymbols = send.tickerSymbols.filter(
      (symbol) => !filedUnder.has(symbol),
    );
    if (missingTickerSymbols.length > 0) {
      note(result.annotationsMissingTicker, {
        canonicalUrl,
        annotation: annotation.iri,
        missingTickerSymbols,
      });
    }
  }

  for (const figure of evidence.figuresWithoutAnnotation) {
    note(result.figuresWithoutAnnotation, {
      canonicalUrl,
      figure: figure.label ?? figure.iri,
    });
  }
};

export const checkEvidence = async ({
  organon,
  dataApi,
  sentAfter,
  sentBefore,
  take,
  concurrency,
}: {
  organon: Pick<OrganonIngestionClient, "getJobStatus" | "articleEvidence">;
  dataApi: Pick<AgentDataApiClient, "organonIngestionSends">;
  sentAfter: Date;
  sentBefore: Date;
  take: number;
  concurrency: number;
}): Promise<EvidenceCheckResult> => {
  const { sends } = await dataApi.organonIngestionSends.get({
    sentAfter: sentAfter.toISOString(),
    sentBefore: sentBefore.toISOString(),
    take,
  });
  const result: EvidenceCheckResult = {
    sends: sends.length,
    checked: 0,
    skipped: { unfinished: 0, failed: 0, jobNotFound: 0 },
    quotesUnchecked: 0,
    withoutAnnotations: emptyTally(),
    quotesNotInText: emptyTally(),
    figuresWithoutAnnotation: emptyTally(),
    annotationsMissingTicker: emptyTally(),
    errors: emptyTally(),
  };

  await pMap(
    sends,
    async (send) => {
      try {
        const status = await organon.getJobStatus(send.organonJobId);
        if (status === null) {
          result.skipped.jobNotFound += 1;
          return;
        }
        if (UNFINISHED_JOB_STATUSES.has(status)) {
          result.skipped.unfinished += 1;
          return;
        }
        if (status !== "completed") {
          result.skipped.failed += 1;
          return;
        }
        const evidence = await organon.articleEvidence(send.canonicalUrl);
        result.checked += 1;
        recordProblems(result, send, evidence);
      } catch (error) {
        note(result.errors, {
          canonicalUrl: send.canonicalUrl,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    { concurrency },
  );

  return result;
};
