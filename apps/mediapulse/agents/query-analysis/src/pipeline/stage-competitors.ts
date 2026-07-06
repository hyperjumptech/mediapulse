import type { DiscoveredEntity } from "../discovery/schema";
import { buildEntityQueryTexts } from "../keywords/build-keywords";
import type { Candidate, Language } from "./types";

/**
 * Builds competitor candidates: the entity name and `name keyword` combinations,
 * per language, under the `competitor` intent.
 *
 * @param competitors - Discovered competitor entities.
 * @param languages - Languages to emit candidates for.
 * @param maxKeywords - Maximum keyword-augmented queries per entity.
 * @returns LLM-sourced competitor candidates.
 */
export const buildCompetitorCandidates = (
  competitors: DiscoveredEntity[],
  languages: readonly Language[],
  maxKeywords: number,
): Candidate[] => {
  const candidates: Candidate[] = [];
  for (const language of languages) {
    for (const competitor of competitors) {
      for (const text of buildEntityQueryTexts(competitor, maxKeywords)) {
        candidates.push({
          text,
          intent: "competitor",
          language,
        });
      }
    }
  }

  return candidates;
};
