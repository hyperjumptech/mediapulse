import { scoreAliasMatch } from "./signals/alias-match.js";
import { scoreEntityOverlap } from "./signals/entity-overlap.js";
import { scoreFreshness } from "./signals/freshness.js";
import { scoreNovelty } from "./signals/novelty.js";
import { scoreSourceQuality } from "./signals/source-quality.js";

export type ScoreWeights = {
  aliasMatch: number;
  entityOverlap: number;
  freshness: number;
  sourceQuality: number;
  novelty: number;
};

export type ScoreConfig = {
  weights: ScoreWeights;
  maxSelected: number;
  minScoreThreshold: number;
  trustedDomains: Record<string, number>;
};

export type ScorableArticle = {
  dataSourceId: string;
  url: string;
  title: string;
  content: string;
  createdAt: Date;
  extractedEntityNames: string[];
};

export type ArticleRelevance = {
  dataSourceId: string;
  score: number;
  scoreBreakdown: Record<string, number>;
  selected: boolean;
};

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  aliasMatch: 0.3,
  entityOverlap: 0.3,
  freshness: 0.2,
  sourceQuality: 0.1,
  novelty: 0.1,
};

export const DEFAULT_TRUSTED_DOMAINS: Record<string, number> = {
  "kontan.co.id": 0.85,
  "bisnis.com": 0.85,
  "cnbcindonesia.com": 0.8,
  "idxchannel.com": 0.8,
  "reuters.com": 0.9,
  "bloomberg.com": 0.9,
  "finance.yahoo.com": 0.75,
};

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  weights: DEFAULT_SCORE_WEIGHTS,
  maxSelected: 10,
  minScoreThreshold: 0.25,
  trustedDomains: DEFAULT_TRUSTED_DOMAINS,
};

/**
 * Scores candidate articles and selects top entries using configurable signals.
 *
 * @param articles - Articles and extracted entities to score.
 * @param tickerAliases - Ticker aliases including symbol and company name.
 * @param existingEntityNames - Existing ticker entities and aliases.
 * @param config - Scoring configuration.
 * @param now - Current time reference for deterministic freshness tests.
 * @returns Scored relevance rows with selected flags.
 */
export const scoreArticles = ({
  articles,
  tickerAliases,
  existingEntityNames,
  config,
  now = new Date(),
}: {
  articles: ScorableArticle[];
  tickerAliases: string[];
  existingEntityNames: string[];
  config: ScoreConfig;
  now?: Date;
}): ArticleRelevance[] => {
  if (articles.length === 0) {
    return [];
  }

  const preliminary = articles
    .map((article) => {
      const aliasMatch = scoreAliasMatch({
        title: article.title,
        content: article.content,
        aliases: tickerAliases,
      });
      const entityOverlap = scoreEntityOverlap({
        articleEntities: article.extractedEntityNames,
        existingEntityNames,
      });
      const freshness = scoreFreshness({ createdAt: article.createdAt, now });
      const sourceQuality = scoreSourceQuality({
        articleUrl: article.url,
        trustedDomains: config.trustedDomains,
      });
      const preScore =
        config.weights.aliasMatch * aliasMatch +
        config.weights.entityOverlap * entityOverlap +
        config.weights.freshness * freshness +
        config.weights.sourceQuality * sourceQuality +
        config.weights.novelty * 1;

      return {
        article,
        aliasMatch,
        entityOverlap,
        freshness,
        sourceQuality,
        preScore,
      };
    })
    .sort((left, right) => {
      if (right.preScore !== left.preScore) {
        return right.preScore - left.preScore;
      }
      return left.article.dataSourceId.localeCompare(
        right.article.dataSourceId,
      );
    });

  const selectedTitles: string[] = [];
  let selectedCount = 0;

  return preliminary.map((candidate) => {
    const novelty = scoreNovelty({
      title: candidate.article.title,
      selectedTitles,
    });
    const score =
      config.weights.aliasMatch * candidate.aliasMatch +
      config.weights.entityOverlap * candidate.entityOverlap +
      config.weights.freshness * candidate.freshness +
      config.weights.sourceQuality * candidate.sourceQuality +
      config.weights.novelty * novelty;

    const selected =
      score >= config.minScoreThreshold && selectedCount < config.maxSelected;
    if (selected) {
      selectedCount += 1;
      selectedTitles.push(candidate.article.title);
    }

    return {
      dataSourceId: candidate.article.dataSourceId,
      score,
      scoreBreakdown: {
        aliasMatch: candidate.aliasMatch,
        entityOverlap: candidate.entityOverlap,
        freshness: candidate.freshness,
        sourceQuality: candidate.sourceQuality,
        novelty,
      },
      selected,
    };
  });
};
