import type { QueryAnalysisIntent } from "@workspace/agent-data-api-contract";

/** Per-intent sampling multiplier applied when merging persona-scoped candidates. */
export type PersonaIntentBias = {
  breaking: number;
  kg_change: number;
  fundamental: number;
};

/** Static query-generation persona resolved from Hermes config ids. */
export type QueryPersona = {
  id: string;
  displayName: string;
  /** One–two sentences appended to the base system prompt for this voice. */
  systemNudge: string;
  intentBias: PersonaIntentBias;
};

/** Sell-side equity research voice. */
const analystPersona: QueryPersona = {
  id: "analyst",
  displayName: "Sell-side analyst",
  systemNudge:
    "Write like a sell-side equity analyst: earnings drivers, segment trends, and peer comps. Prefer institutional phrasing.",
  intentBias: { breaking: 1.0, kg_change: 0.9, fundamental: 1.2 },
};

/** Retail trader / momentum-focused voice. */
const retailPersona: QueryPersona = {
  id: "retail",
  displayName: "Retail trader",
  systemNudge:
    "Write like an active retail trader: catalysts, price action, social buzz, and near-term setups. Keep queries short and searchable.",
  intentBias: { breaking: 1.5, kg_change: 0.7, fundamental: 0.6 },
};

/** Regulatory and disclosure-focused voice. */
const regulatorPersona: QueryPersona = {
  id: "regulator",
  displayName: "Regulator",
  systemNudge:
    "Focus on compliance, disclosure, and rulemaking angles. Skip price action and trading slang.",
  intentBias: { breaking: 0.5, kg_change: 1.0, fundamental: 1.5 },
};

/** ESG and sustainability research voice. */
const esgPersona: QueryPersona = {
  id: "esg",
  displayName: "ESG researcher",
  systemNudge:
    "Emphasize environmental, social, and governance risks, controversies, and stewardship angles. Avoid pure technical chart queries.",
  intentBias: { breaking: 0.8, kg_change: 1.1, fundamental: 1.3 },
};

/** Contrarian / short-thesis voice. */
const shortSellerPersona: QueryPersona = {
  id: "short_seller",
  displayName: "Short seller",
  systemNudge:
    "Surface bearish and forensic angles: accounting red flags, supply-chain weakness, auditor concerns, and downside catalysts others ignore.",
  intentBias: { breaking: 1.2, kg_change: 1.0, fundamental: 1.4 },
};

/** In-process persona library keyed by stable id. */
export const DEFAULT_QUERY_PERSONAS: QueryPersona[] = [
  analystPersona,
  retailPersona,
  regulatorPersona,
  esgPersona,
  shortSellerPersona,
];

const personaById = new Map(
  DEFAULT_QUERY_PERSONAS.map((persona) => [persona.id, persona]),
);

/**
 * Resolves Hermes persona id strings against the in-process library.
 * Unknown ids are omitted with a warning via the optional logger.
 *
 * @param ids - Persona ids from invoke config (order preserved).
 * @param deps - Optional warn logger for unknown ids.
 * @returns Matching persona definitions in config order.
 */
export const resolveQueryPersonas = (
  ids: string[],
  deps: {
    warn?: (message: string, meta: { unknownId: string }) => void;
  } = {},
): QueryPersona[] => {
  const resolved: QueryPersona[] = [];
  for (const id of ids) {
    const persona = personaById.get(id);
    if (persona) {
      resolved.push(persona);
    } else {
      deps.warn?.("unknown query-analysis persona id; skipping", {
        unknownId: id,
      });
    }
  }
  return resolved;
};

/**
 * Returns the persona-scoped merge weight for a candidate intent.
 *
 * @param intent - Query intent label.
 * @param persona - Persona whose bias multipliers apply.
 * @param baseWeights - Global strategy weights from the snapshot.
 * @returns Combined weight for ordering within a persona group.
 */
export const personaIntentMergeWeight = (
  intent: QueryAnalysisIntent,
  persona: QueryPersona,
  baseWeights: Record<QueryAnalysisIntent, number>,
): number => {
  const base = baseWeights[intent] ?? 0;
  const bias =
    intent === "breaking"
      ? persona.intentBias.breaking
      : intent === "kg_change"
        ? persona.intentBias.kg_change
        : intent === "fundamental"
          ? persona.intentBias.fundamental
          : 1;
  return base * bias;
};
