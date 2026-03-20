export type QueryAnalysisContext = {
  ticker: {
    id: string;
    symbol: string;
    name: string;
    metadata: unknown;
  };
  topEntities: Array<{
    canonicalName: string;
    typeName: string;
    relevanceWeight: number;
  }>;
  recentThemes: Array<{
    theme: string;
    articleCount: number;
  }>;
};

export const EXPECTED_QUERY_COUNT = 8;

/**
 * Builds the system and user prompts for query-analysis generation.
 *
 * @param context - Query-analysis context fetched from the data API.
 * @returns Prompt pair for OpenAI chat completion.
 */
export const buildPrompt = (
  context: QueryAnalysisContext,
): { systemPrompt: string; userPrompt: string } => {
  const tickerMetadata = formatTickerMetadata(context);
  const hasWarmContext =
    context.topEntities.length > 0 || context.recentThemes.length > 0;

  const systemPrompt = `You are a financial news research assistant for the Indonesian stock market (IDX).

Your job: generate search query strings that will find the most relevant, recent news articles about a specific ticker and its business context.

Rules:
- Generate exactly ${EXPECTED_QUERY_COUNT} query strings.
- Each query should target a different angle (company-specific news, sector trends, key people, competitors, regulatory, earnings/financials, partnerships/deals, market sentiment).
- Use a mix of Indonesian and English queries, since Indonesian financial news appears in both languages.
- Include the ticker symbol or company name in most queries for precision.
- Queries should be optimized for Google News search (short, keyword-rich, no boolean operators).
- Prefer recent/time-sensitive angles (earnings, quarterly results, recent deals) over evergreen content.
- Return a JSON object with key "queries" and value as an array: { "queries": [{ "text": "query string", "angle": "brief label" }] }`;

  if (!hasWarmContext) {
    return {
      systemPrompt,
      userPrompt: `Generate search queries for this IDX-listed company:

${tickerMetadata}

There is no prior knowledge graph for this ticker yet. Generate broad discovery queries
that will help us learn about the company's current activities, key people, subsidiaries,
competitors, and recent developments.`,
    };
  }

  const topEntities = formatTopEntities(context);
  const recentThemes = formatRecentThemes(context);

  return {
    systemPrompt,
    userPrompt: `Generate search queries for this IDX-listed company:

${tickerMetadata}

Known entities in this ticker's knowledge graph (most relevant first):
${topEntities}

Recent article themes from past 7 days:
${recentThemes}

Generate queries that:
1. Track ongoing stories from the themes above.
2. Discover NEW developments not yet in the knowledge graph.
3. Cover the company's key entities and relationships.`,
  };
};

/**
 * Formats ticker metadata into prompt-friendly lines.
 *
 * @param context - Query-analysis context.
 * @returns Joined ticker metadata lines.
 */
const formatTickerMetadata = (context: QueryAnalysisContext): string => {
  const metadata = readTickerMetadata(context.ticker.metadata);
  return [
    `Ticker: ${context.ticker.symbol}`,
    `Company: ${context.ticker.name}`,
    `Sector: ${metadata.sector}`,
    `Industry: ${metadata.industry}`,
    `Sub-industry: ${metadata.subIndustry}`,
    `Business: ${metadata.business}`,
  ].join("\n");
};

/**
 * Reads ticker metadata from an unknown DB JSON payload.
 *
 * @param metadata - Raw ticker metadata.
 * @returns Normalized fields used in prompt construction.
 */
const readTickerMetadata = (
  metadata: unknown,
): {
  sector: string;
  industry: string;
  subIndustry: string;
  business: string;
} => {
  if (!metadata || typeof metadata !== "object") {
    return {
      sector: "Unknown",
      industry: "Unknown",
      subIndustry: "Unknown",
      business: "Unknown",
    };
  }

  const record = metadata as Record<string, unknown>;
  return {
    sector: safeString(record.Sektor),
    industry: safeString(record.Industri),
    subIndustry: safeString(record.SubIndustri),
    business: safeString(record.KegiatanUsahaUtama),
  };
};

/**
 * Formats top entities as bullet lines.
 *
 * @param context - Query-analysis context.
 * @returns Bullet list or fallback text.
 */
const formatTopEntities = (context: QueryAnalysisContext): string => {
  if (context.topEntities.length === 0) {
    return "- None";
  }

  return context.topEntities
    .map((entity) => `- ${entity.canonicalName} (${entity.typeName})`)
    .join("\n");
};

/**
 * Formats recent themes as bullet lines.
 *
 * @param context - Query-analysis context.
 * @returns Bullet list or fallback text.
 */
const formatRecentThemes = (context: QueryAnalysisContext): string => {
  if (context.recentThemes.length === 0) {
    return "- None";
  }

  return context.recentThemes
    .map(
      (theme) =>
        `- ${theme.theme} (appeared in ${theme.articleCount} articles)`,
    )
    .join("\n");
};

/**
 * Converts unknown values into prompt-safe strings.
 *
 * @param value - Unknown field value.
 * @returns Trimmed string or "Unknown".
 */
const safeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "Unknown";
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "Unknown";
};
