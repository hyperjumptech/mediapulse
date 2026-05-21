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
    { text: "P&G pricing vs Unilever consumer staples", intent: "fundamental" },
    { text: "Gillette market share erosion latest", intent: "breaking" },
    { text: "Pampers diaper category volume trends", intent: "fundamental" },
    { text: "Procter Gamble organic sales guidance", intent: "fundamental" },
    { text: "PG relation changes brand portfolio", intent: "kg_change" },
    { text: "why is PG stock moving today", intent: "breaking" },
    { text: "P&G China demand slowdown impact", intent: "breaking" },
    {
      text: "Colgate-Palmolive vs PG margin comparison",
      intent: "fundamental",
    },
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
    { text: "Rockwell Automation order backlog trend", intent: "fundamental" },
    { text: "ROK vs Emerson automation revenue mix", intent: "fundamental" },
    { text: "Allen-Bradley supply chain lead times", intent: "breaking" },
    {
      text: "Rockwell FactoryTalk software attach rate",
      intent: "fundamental",
    },
    { text: "ROK entity relation changes acquisitions", intent: "kg_change" },
    { text: "industrial automation capex cycle 2026", intent: "breaking" },
    { text: "Honeywell vs Rockwell margin outlook", intent: "fundamental" },
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
    { text: "JPMorgan net interest margin Q2 outlook", intent: "fundamental" },
    {
      text: "Basel III endgame impact JPM capital ratios",
      intent: "fundamental",
    },
    { text: "JPM stress test results Fed response", intent: "breaking" },
    {
      text: "Chase consumer credit card delinquency trend",
      intent: "fundamental",
    },
    { text: "JPMorgan relation changes subsidiary map", intent: "kg_change" },
    { text: "why is JPM stock falling today", intent: "breaking" },
    { text: "JPM dividend increase vs peers yield", intent: "fundamental" },
    { text: "First Republic integration cost overrun", intent: "breaking" },
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
    {
      text: "Salesforce Agentforce adoption enterprise pilots",
      intent: "breaking",
    },
    { text: "CRM AI agents monetization model", intent: "fundamental" },
    { text: "Slack integration Salesforce bundle attach", intent: "kg_change" },
    { text: "Salesforce seat compression ARR impact", intent: "fundamental" },
    { text: "CRM vs Microsoft Dynamics AI comparison", intent: "fundamental" },
    { text: "Salesforce Data Cloud growth rate", intent: "fundamental" },
    { text: "why is CRM moving after earnings", intent: "breaking" },
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
