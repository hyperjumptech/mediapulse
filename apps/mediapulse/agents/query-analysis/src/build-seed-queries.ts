import type { QueryAnalysisIntent } from "@workspace/agent-data-api-contract";
import { SECTION_BY_INTENT } from "@workspace/agent-data-api-contract";

import type { DeterministicCandidate } from "./merge-query-candidates";
import { resolveEntityDisplayName } from "./i18n/entity-aliases";

type SeedContext = {
  ticker: { symbol: string; name: string };
};

/**
 * Builds a small hardcoded deterministic seed for a language slice.
 * Emits symbol and company-name anchors plus one candidate per newsletter-section intent.
 *
 * @param context - Ticker context with symbol and name.
 * @param options - BCP-47 language for display-name resolution.
 * @returns Deterministic seed candidates.
 */
export const buildSeedQueries = (
  context: SeedContext,
  options: { language: string },
): DeterministicCandidate[] => {
  const { symbol, name } = context.ticker;
  const localizedName = resolveEntityDisplayName(
    symbol,
    name,
    options.language,
  );

  const rows: DeterministicCandidate[] = [
    { text: symbol, intent: "breaking", language: options.language },
    { text: localizedName, intent: "breaking", language: options.language },
  ];

  const seenIntents = new Set<string>(["breaking"]);

  for (const [intent, sectionId] of Object.entries(SECTION_BY_INTENT)) {
    if (sectionId === null) {
      continue;
    }
    const typedIntent = intent as QueryAnalysisIntent;
    if (seenIntents.has(typedIntent)) {
      continue;
    }
    seenIntents.add(typedIntent);
    rows.push({
      text: `${localizedName} ${typedIntent.replace(/_/g, " ")}`,
      intent: typedIntent,
      language: options.language,
    });
  }

  return rows;
};
