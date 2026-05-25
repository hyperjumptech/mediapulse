import type { EventBiasRule } from "./event-bias";
import { hasRecentMergerDelta, hasRecentRegulatoryEvent } from "./event-bias";

/** Default conservative event-bias rules (multipliers ≤ 2, never below 1×). */
export const DEFAULT_EVENT_BIAS_RULES: EventBiasRule[] = [
  {
    id: "recent-merger-delta",
    when: (context) => hasRecentMergerDelta(context),
    bias: { kg_change: 2, competitor: 1.5 },
  },
  {
    id: "recent-regulatory-event",
    when: (context) => hasRecentRegulatoryEvent(context),
    bias: { regulatory: 1.5, macro: 1.3 },
  },
];
