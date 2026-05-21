import type { GetQueryAnalysisResponse } from "@workspace/agent-data-api-contract";

import type { DeterministicCandidate } from "../merge-query-candidates";
import {
  type DeterministicPackName,
  getDeterministicPack,
} from "./deterministic-packs";
import {
  type SlotResolverClock,
  expandKgRelationQueries,
  resolveTemplatePattern,
  resolveSlots,
} from "./slot-resolver";

/** Default cap for KG-derived deterministic query rows. */
export const DEFAULT_KG_TEMPLATE_CAP = 6;

/** Options for building deterministic query candidates from a template pack. */
export type BuildDeterministicQueriesOptions = {
  pack?: DeterministicPackName | string;
  clock?: SlotResolverClock;
  /** Maximum KG relation rows to expand (`0` disables KG templates). */
  kgTemplateCap?: number;
  /** BCP-47 language for localized slot resolution and row tagging. */
  language?: string;
};

/**
 * Builds deterministic baseline query candidates from context and a named pack.
 *
 * @param context - GET /query-analysis response (ticker, entities, themes).
 * @param options - Pack name, clock, KG cap, and optional language tag.
 * @returns Rendered candidates; templates with unresolved slots are omitted.
 */
export const buildDeterministicQueries = (
  context: GetQueryAnalysisResponse,
  options: BuildDeterministicQueriesOptions = {},
): DeterministicCandidate[] => {
  const packName = options.pack ?? "default-v1";
  const clock = options.clock ?? (() => new Date());
  const kgTemplateCap = options.kgTemplateCap ?? DEFAULT_KG_TEMPLATE_CAP;
  const pack = getDeterministicPack(packName);
  const slots = resolveSlots(context, clock, options.language);
  const candidates: DeterministicCandidate[] = [];

  for (const row of pack.templates) {
    const text = resolveTemplatePattern(row.template, slots);
    if (text) {
      candidates.push({
        text,
        intent: row.intent,
        ...(options.language !== undefined ? { language: options.language } : {}),
      });
    }
  }

  if (pack.kgRelationTemplates) {
    candidates.push(
      ...expandKgRelationQueries(
        context,
        pack.kgRelationTemplates,
        slots,
        kgTemplateCap,
      ).map((row) => ({
        ...row,
        ...(options.language !== undefined ? { language: options.language } : {}),
      })),
    );
  }

  return candidates;
};
