import type { Candidate, Language } from "./types";

/**
 * Indonesian corporate-action trigger terms that surface deal/movement news.
 * Emitted as `${name} ${term}` under the `deals` intent.
 */
export const CORPORATE_ACTION_TERMS = [
  "akuisisi",
  "rights issue",
  "dividen",
  "RUPS",
] as const;

/**
 * Builds own-company candidates: the symbol and full name (breaking) plus
 * corporate-action trigger phrases (deals), per language.
 *
 * @param ticker - The issuer symbol and name.
 * @param languages - Languages to emit candidates for.
 * @returns Deterministic own-company candidates.
 */
export const buildOwnCompanyCandidates = (
  ticker: { symbol: string; name: string },
  languages: readonly Language[],
): Candidate[] => {
  const candidates: Candidate[] = [];
  const symbol = ticker.symbol.trim();
  const name = ticker.name.trim();

  for (const language of languages) {
    if (symbol.length > 0) {
      candidates.push({
        text: symbol,
        intent: "breaking",
        language,
      });
    }
    if (name.length > 0) {
      candidates.push({
        text: name,
        intent: "breaking",
        language,
      });
      for (const term of CORPORATE_ACTION_TERMS) {
        candidates.push({
          text: `${name} ${term}`,
          intent: "deals",
          language,
        });
      }
    }
  }

  return candidates;
};
