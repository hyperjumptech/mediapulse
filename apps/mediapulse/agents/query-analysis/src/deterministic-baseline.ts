import type { GetQueryAnalysisResponse } from "@workspace/agent-data-api-contract";

/** One candidate row before merge/ranking. */
export type QueryCandidate = {
  text: string;
  source: "deterministic" | "llm";
  intent: "breaking" | "kg_change" | "fundamental";
  rank: number;
};

/**
 * Builds a reproducible baseline query list from ticker metadata and optional top entities (PRD deterministic phase).
 *
 * @param ctx - Subset of the agent-data-api GET payload (ticker, entities, min count).
 * @returns Deterministic candidates tagged with `source: deterministic`.
 */
export const buildDeterministicBaseline = (
  ctx: Pick<
    GetQueryAnalysisResponse,
    "ticker" | "topEntities" | "configSnapshot"
  >,
): QueryCandidate[] => {
  const { symbol, name } = ctx.ticker;
  const min = ctx.configSnapshot.minDeterministicCount;
  const templates: Array<{
    text: string;
    intent: QueryCandidate["intent"];
  }> = [
    { text: `${symbol} latest news`, intent: "breaking" },
    { text: `${name} earnings guidance`, intent: "fundamental" },
    { text: `${name} regulatory update`, intent: "kg_change" },
    { text: `${name} partnership announcement`, intent: "fundamental" },
  ];

  const fromEntities = ctx.topEntities.slice(0, 3).map((e) => ({
    text: `${name} ${e.canonicalName}`,
    intent: "fundamental" as const,
  }));

  const merged = [...templates, ...fromEntities];
  const target = Math.max(min, templates.length);
  const padded = [...merged];
  let i = 0;
  while (padded.length < target) {
    padded.push({
      text: `${symbol} stock update ${i + 1}`,
      intent: "breaking" as const,
    });
    i += 1;
  }

  const picked = padded.slice(0, target);

  return picked.map((row, index) => ({
    text: row.text,
    source: "deterministic",
    intent: row.intent,
    rank: index,
  }));
};
