import {
  postAnalysisBodySchema,
  type PostAnalysisBody,
} from "@workspace/agent-data-api-contract";

import type { ArticleRelevanceRow } from "./analysis-relevance-scoring.js";

export type BuildArticleRelevancePostChunksResult = {
  chunks: PostAnalysisBody[];
  parseErrors: string[];
};

/**
 * Partitions `articleRelevances` into sequential POST bodies (other arrays empty per FR9-style chunking).
 *
 * @param tickerId - Ticker id for each body.
 * @param articleRelevances - Final rows after selection.
 * @param postChunkArticleRelevanceBatchSize - Max rows per POST.
 * @returns Chunks that pass `postAnalysisBodySchema.safeParse`.
 */
export const buildArticleRelevancePostChunks = (
  tickerId: string,
  articleRelevances: readonly ArticleRelevanceRow[],
  postChunkArticleRelevanceBatchSize: number,
): BuildArticleRelevancePostChunksResult => {
  const chunks: PostAnalysisBody[] = [];
  const parseErrors: string[] = [];

  for (
    let i = 0;
    i < articleRelevances.length;
    i += postChunkArticleRelevanceBatchSize
  ) {
    const window = articleRelevances.slice(
      i,
      i + postChunkArticleRelevanceBatchSize,
    );
    const body: PostAnalysisBody = {
      tickerId,
      entities: [],
      relations: [],
      articleEntities: [],
      articleRelevances: [...window],
      entityEvidence: [],
      relationEvidence: [],
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
