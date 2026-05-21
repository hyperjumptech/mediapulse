import {
  QUERY_ANALYSIS_INTENTS,
  type GetQueryAnalysisResponse,
  type QueryAnalysisIntent,
  type QueryAnalysisIntentWeights,
} from "@workspace/agent-data-api-contract";

/** Injectable clock for temporal predicates and slot resolution. */
export type EventBiasClock = () => Date;

/** Per-intent multipliers contributed by a single event-bias rule (values ≥ 1). */
export type EventBiasMultipliers = Partial<Record<QueryAnalysisIntent, number>>;

/** Declarative rule: predicate plus intent multipliers when it matches. */
export type EventBiasRule = {
  id: string;
  when: (context: GetQueryAnalysisResponse, clock: EventBiasClock) => boolean;
  bias: EventBiasMultipliers;
};

/** Outcome of walking the rule library against live GET context. */
export type EventBiasResult = {
  multipliers: EventBiasMultipliers;
  firedRuleIds: string[];
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns whole days from `clock` until the next earnings date, when known.
 *
 * @param context - GET /query-analysis payload with optional calendar.
 * @param clock - Reference instant (default: now).
 * @returns Non-negative day count, or `undefined` when earnings date is absent.
 */
export const daysUntilEarnings = (
  context: GetQueryAnalysisResponse,
  clock: EventBiasClock = () => new Date(),
): number | undefined => {
  const nextEarningsAt = context.calendar.nextEarningsAt;
  if (!nextEarningsAt) {
    return undefined;
  }
  const target = new Date(nextEarningsAt);
  if (Number.isNaN(target.getTime())) {
    return undefined;
  }
  const diffMs = target.getTime() - clock().getTime();
  if (diffMs <= 0) {
    return 0;
  }
  return Math.ceil(diffMs / MS_PER_DAY);
};

/** Relation-type tokens that indicate a recent merger or acquisition delta. */
const MERGER_RELATION_PATTERN =
  /merger|acquisition|acquire|acquired|m&a|takeover/i;

/**
 * Returns whether recent relation deltas include a merger-style edge.
 *
 * @param context - GET /query-analysis payload with optional relation deltas.
 * @returns `true` when a non-removed merger-like delta is present.
 */
export const hasRecentMergerDelta = (
  context: GetQueryAnalysisResponse,
): boolean =>
  (context.recentRelationDeltas ?? []).some(
    (delta) =>
      delta.change !== "removed" &&
      MERGER_RELATION_PATTERN.test(delta.relationType),
  );

/** Calendar event-type tokens treated as regulatory catalysts. */
const REGULATORY_EVENT_PATTERN =
  /regulat|compliance|antitrust|policy|sanction|sec_|fda_|investigation/i;

/**
 * Returns whether recent calendar event types include a regulatory catalyst.
 *
 * @param context - GET /query-analysis payload with calendar event types.
 * @returns `true` when a regulatory-like event type appears in the window.
 */
export const hasRecentRegulatoryEvent = (
  context: GetQueryAnalysisResponse,
): boolean =>
  context.calendar.recentEventTypes.some((eventType) =>
    REGULATORY_EVENT_PATTERN.test(eventType),
  );

/**
 * Merges per-intent multipliers by taking the product across fired rules.
 *
 * @param left - Accumulated multipliers so far.
 * @param right - Multipliers from the next matching rule.
 * @returns Combined multiplier map.
 */
export const mergeEventBiasMultipliers = (
  left: EventBiasMultipliers,
  right: EventBiasMultipliers,
): EventBiasMultipliers => {
  const merged: EventBiasMultipliers = { ...left };
  for (const [intent, multiplier] of Object.entries(right) as Array<
    [QueryAnalysisIntent, number]
  >) {
    merged[intent] = (merged[intent] ?? 1) * multiplier;
  }
  return merged;
};

/**
 * Walks predicate rules in order and returns merged intent multipliers plus fired ids.
 *
 * @param context - Live GET /query-analysis context.
 * @param clock - Reference instant for temporal predicates.
 * @param rules - Rule library (default supplied by caller).
 * @returns Per-intent multipliers and ids of rules that matched.
 */
export const computeEventBias = (
  context: GetQueryAnalysisResponse,
  clock: EventBiasClock = () => new Date(),
  rules: EventBiasRule[],
): EventBiasResult => {
  let multipliers: EventBiasMultipliers = {};
  const firedRuleIds: string[] = [];

  for (const rule of rules) {
    if (!rule.when(context, clock)) {
      continue;
    }
    firedRuleIds.push(rule.id);
    multipliers = mergeEventBiasMultipliers(multipliers, rule.bias);
  }

  return { multipliers, firedRuleIds };
};

/**
 * Multiplies configured intent weights by event-bias multipliers (intents without bias unchanged).
 *
 * @param weights - Base intent weights from Hermes config.
 * @param multipliers - Per-intent products from {@link computeEventBias}.
 * @returns Adjusted weights for prompt target counts and merge ordering.
 */
export const applyEventBiasToIntentWeights = (
  weights: QueryAnalysisIntentWeights,
  multipliers: EventBiasMultipliers,
): QueryAnalysisIntentWeights => {
  const adjusted = { ...weights };
  for (const intent of QUERY_ANALYSIS_INTENTS) {
    const multiplier = multipliers[intent];
    if (multiplier !== undefined) {
      adjusted[intent] = weights[intent] * multiplier;
    }
  }
  return adjusted;
};
