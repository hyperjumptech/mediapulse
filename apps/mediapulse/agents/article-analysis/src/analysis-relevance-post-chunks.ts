import {
  postAnalysisBodySchema,
  type PostAnalysisBody,
} from "@workspace/agent-data-api-contract";

import type { ArticleRelevanceRow } from "./analysis-relevance-scoring.js";

export type BuildArticleRelevancePostChunksResult = {
  chunks: PostAnalysisBody[];
  parseErrors: string[];
};

export type BuildArticleRelevancePostChunksOptions = {
  /** Attached to the final chunk only (global backlog mark-as-analyzed). */
  analyzedDataSourceIds?: readonly string[];
};

/**
 * Partitions `articleRelevances` into sequential POST bodies (other arrays empty per FR9-style chunking).
 *
 * @param tickerId - Ticker id for legacy runs; omit for global inference POST bodies.
 * @param articleRelevances - Final rows after selection.
 * @param postChunkArticleRelevanceBatchSize - Max rows per POST.
 * @param options - Optional `analyzedDataSourceIds` for the final chunk.
 * @returns Chunks that pass `postAnalysisBodySchema.safeParse`.
 */
export const buildArticleRelevancePostChunks = (
  tickerId: string | undefined,
  articleRelevances: readonly ArticleRelevanceRow[],
  postChunkArticleRelevanceBatchSize: number,
  options?: BuildArticleRelevancePostChunksOptions,
): BuildArticleRelevancePostChunksResult => {
  const chunks: PostAnalysisBody[] = [];
  const parseErrors: string[] = [];
  const analyzedDataSourceIds = options?.analyzedDataSourceIds ?? [];

  for (
    let i = 0;
    i < articleRelevances.length;
    i += postChunkArticleRelevanceBatchSize
  ) {
    const window = articleRelevances.slice(
      i,
      i + postChunkArticleRelevanceBatchSize,
    );
    const isFinalChunk =
      i + postChunkArticleRelevanceBatchSize >= articleRelevances.length;
    const body: PostAnalysisBody = {
      ...(tickerId !== undefined ? { tickerId } : {}),
      entities: [],
      relations: [],
      articleEntities: [],
      articleRelevances: [...window],
      entityEvidence: [],
      relationEvidence: [],
      tickers: [],
      analyzedDataSourceIds:
        isFinalChunk && analyzedDataSourceIds.length > 0
          ? [...analyzedDataSourceIds]
          : [],
    };
    const parsed = postAnalysisBodySchema.safeParse(body);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        parseErrors.push(issue.message);
      }
      continue;
    }
    chunks.push(parsed.data);
  }

  return { chunks, parseErrors };
};
