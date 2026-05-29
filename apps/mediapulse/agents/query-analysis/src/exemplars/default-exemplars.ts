import type { QueryAnalysisIntent } from "@workspace/agent-data-api-contract";

/** One curated few-shot query row with intent label. */
export type QueryExemplarRow = {
  text: string;
  intent: QueryAnalysisIntent;
};

/** Hand-written (context → queries) pair for few-shot prompting. */
export type QueryExemplar = {
  /** Serialized ticker context block shown to the model. */
  context: string;
  /** Example queries demonstrating tone, granularity, and intent mix. */
  queries: QueryExemplarRow[];
};

/** Large-cap consumer staples archetype. */
const largeCapConsumerExemplar: QueryExemplar = {
  context: [
    "Ticker symbol: PG",
    "Company name: Procter & Gamble Co",
    "Top entities:",
    "- Gillette (Brand) relevance=0.85",
    "- Pampers (Brand) relevance=0.8",
    "Recent themes:",
    "- pricing power (articles: 4)",
    "- organic growth (articles: 3)",
    "Sector peers:",
    "- KO (Coca-Cola Co) relevance=1",
    "- CL (Colgate-Palmolive) relevance=0.9",
  ].join("\n"),
  queries: [
    { text: "Procter Gamble", intent: "breaking" },
    { text: "Gillette market share", intent: "breaking" },
    { text: "Pampers diaper market", intent: "industry_trend" },
    { text: "consumer staples pricing", intent: "macro" },
    { text: "household products China demand", intent: "macro" },
    { text: "Unilever consumer goods", intent: "competitor" },
    { text: "personal care regulation", intent: "regulatory" },
    { text: "consumer staples ESG", intent: "esg" },
  ],
};

/** Mid-cap industrial manufacturer archetype. */
const midCapIndustrialExemplar: QueryExemplar = {
  context: [
    "Ticker symbol: ROK",
    "Company name: Rockwell Automation Inc",
    "Top entities:",
    "- FactoryTalk (Product) relevance=0.75",
    "- Allen-Bradley (Brand) relevance=0.9",
    "Recent themes:",
    "- automation backlog (articles: 5)",
    "- semiconductor capex (articles: 2)",
    "Sector peers:",
    "- EMR (Emerson Electric) relevance=1",
    "- HON (Honeywell) relevance=0.85",
  ].join("\n"),
  queries: [
    { text: "Rockwell Automation", intent: "breaking" },
    { text: "Allen-Bradley supply chain", intent: "supply_chain" },
    { text: "industrial automation backlog", intent: "industry_trend" },
    { text: "factory automation capex", intent: "macro" },
    { text: "Emerson automation market", intent: "competitor" },
    { text: "industrial software regulation", intent: "regulatory" },
    { text: "automation semiconductor supply", intent: "supply_chain" },
  ],
};

/** Regulated financial institution archetype. */
const regulatedFinancialExemplar: QueryExemplar = {
  context: [
    "Ticker symbol: JPM",
    "Company name: JPMorgan Chase & Co",
    "Top entities:",
    "- Chase Bank (Subsidiary) relevance=0.95",
    "- First Republic assets (Acquisition) relevance=0.6",
    "Recent themes:",
    "- net interest margin (articles: 6)",
    "- Basel III endgame (articles: 4)",
    "Calendar:",
    "- Recent events: stress_test, dividend_increase",
  ].join("\n"),
  queries: [
    { text: "JPMorgan Chase", intent: "breaking" },
    { text: "Basel III bank capital", intent: "regulatory" },
    { text: "bank stress test Fed", intent: "regulatory" },
    { text: "credit card delinquency US", intent: "macro" },
    { text: "bank net interest margin", intent: "industry_trend" },
    { text: "First Republic acquisition integration", intent: "kg_change" },
    { text: "banking sector ESG", intent: "esg" },
    { text: "consumer banking regulation", intent: "regulatory" },
  ],
};

/** High-growth technology platform archetype. */
const techPlatformExemplar: QueryExemplar = {
  context: [
    "Ticker symbol: CRM",
    "Company name: Salesforce Inc",
    "Top entities:",
    "- Slack (Subsidiary) relevance=0.8",
    "- Data Cloud (Product) relevance=0.7",
    "Recent themes:",
    "- AI agents (articles: 8)",
    "- seat compression (articles: 3)",
    "Recent headlines:",
    '- 2026-05-10 (reuters.com) — "Salesforce unveils Agentforce roadmap"',
  ].join("\n"),
  queries: [
    { text: "Salesforce", intent: "breaking" },
    { text: "enterprise AI agents", intent: "technology_trend" },
    { text: "CRM software seat compression", intent: "industry_trend" },
    { text: "Slack enterprise adoption", intent: "kg_change" },
    { text: "Microsoft Dynamics AI", intent: "competitor" },
    { text: "SaaS data cloud market", intent: "industry_trend" },
    { text: "enterprise software regulation", intent: "regulatory" },
  ],
};

/** Version-controlled few-shot library (order is stable for reproducibility). */
export const DEFAULT_QUERY_EXEMPLARS: QueryExemplar[] = [
  largeCapConsumerExemplar,
  midCapIndustrialExemplar,
  regulatedFinancialExemplar,
  techPlatformExemplar,
];

/**
 * Returns the first N curated exemplars for few-shot prompting.
 *
 * @param count - Number of exemplars to include (0 disables few-shot).
 * @returns Slice of the default exemplar library.
 */
export const selectFewShotExemplars = (count: number): QueryExemplar[] =>
  DEFAULT_QUERY_EXEMPLARS.slice(0, Math.max(0, count));

/**
 * Formats exemplar query rows as an assistant-style few-shot response.
 *
 * @param queries - Example query rows with intents.
 * @returns Multi-line assistant content for chat history.
 */
export const formatExemplarAssistantContent = (
  queries: QueryExemplarRow[],
): string => {
  const lines = queries.map(
    (row, index) => `${String(index + 1)}. "${row.text}" (${row.intent})`,
  );
  return ["Here are search queries I would use:", ...lines].join("\n");
};
