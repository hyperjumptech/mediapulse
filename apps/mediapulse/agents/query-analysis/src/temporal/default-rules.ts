import type { EventBiasRule } from "./event-bias";
import {
  daysUntilEarnings,
  hasRecentMergerDelta,
  hasRecentRegulatoryEvent,
} from "./event-bias";

/** Default conservative event-bias rules (multipliers ≤ 2, never below 1×). */
export const DEFAULT_EVENT_BIAS_RULES: EventBiasRule[] = [
  {
    id: "near-earnings",
    when: (context, clock) => {
      const days = daysUntilEarnings(context, clock);
      return days !== undefined && days <= 14;
    },
    bias: { fundamental: 2, sentiment: 1.5 },
  },
  {
    id: "recent-merger-delta",
    when: (context) => hasRecentMergerDelta(context),
    bias: { kg_change: 2, competitor: 1.5 },
  },
  {
    id: "recent-regulatory-event",
    when: (context) => hasRecentRegulatoryEvent(context),
    bias: { macro: 1.5 },
  },
];
