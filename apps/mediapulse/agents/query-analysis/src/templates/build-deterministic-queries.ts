import type { GetQueryAnalysisResponse } from "@workspace/agent-data-api-contract";

import type { DeterministicCandidate } from "../merge-query-candidates";
import {
  type DeterministicPackName,
  getDeterministicPack,
} from "./deterministic-packs";
import {
  type SlotResolverClock,
  resolveTemplatePattern,
  resolveSlots,
} from "./slot-resolver";

/** Options for building deterministic query candidates from a template pack. */
export type BuildDeterministicQueriesOptions = {
  pack?: DeterministicPackName;
  clock?: SlotResolverClock;
};

/**
 * Builds deterministic baseline query candidates from context and a named pack.
 *
 * @param context - GET /query-analysis response (ticker, entities, themes).
 * @param options - Pack name and clock for time slots (defaults: `default-v1`, now).
 * @returns Rendered candidates; templates with unresolved slots are omitted.
 */
export const buildDeterministicQueries = (
  context: GetQueryAnalysisResponse,
  options: BuildDeterministicQueriesOptions = {},
): DeterministicCandidate[] => {
  const packName = options.pack ?? "default-v1";
  const clock = options.clock ?? (() => new Date());
  const pack = getDeterministicPack(packName);
  const slots = resolveSlots(context, clock);
  const candidates: DeterministicCandidate[] = [];

  for (const row of pack.templates) {
    const text = resolveTemplatePattern(row.template, slots);
    if (text) {
      candidates.push({ text, intent: row.intent });
    }
  }

  return candidates;
};
