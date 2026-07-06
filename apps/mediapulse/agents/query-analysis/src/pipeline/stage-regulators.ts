import type { DiscoveredEntity } from "../discovery/schema";
import { buildEntityQueryTexts } from "../keywords/build-keywords";
import type { Candidate, Language } from "./types";

/**
 * Builds regulator candidates: the entity name and `name keyword` combinations,
 * per language, under the `regulatory` intent.
 *
 * @param regulators - Discovered regulator entities.
 * @param languages - Languages to emit candidates for.
 * @param maxKeywords - Maximum keyword-augmented queries per entity.
 * @returns LLM-sourced regulator candidates.
 */
export const buildRegulatorCandidates = (
  regulators: DiscoveredEntity[],
  languages: readonly Language[],
  maxKeywords: number,
): Candidate[] => {
  const candidates: Candidate[] = [];
  for (const language of languages) {
    for (const regulator of regulators) {
      for (const text of buildEntityQueryTexts(regulator, maxKeywords)) {
        candidates.push({
          text,
          intent: "regulatory",
          source: "llm",
          language,
        });
      }
    }
  }

  return candidates;
};
