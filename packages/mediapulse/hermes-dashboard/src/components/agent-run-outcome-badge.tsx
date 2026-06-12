import type { ContentGenerationRunOutcome } from "@workspace/agent-data-api-contract";
import { Badge } from "@workspace/ui/components/badge";

/** Maps outcome values to Badge variant names. */
const OUTCOME_VARIANT_MAP: Record<
  ContentGenerationRunOutcome,
  "success" | "warning" | "destructive"
> = {
  success: "success",
  skipped: "warning",
  failed: "destructive",
};

/** Maps outcome values to human-readable labels. */
const OUTCOME_LABEL_MAP: Record<ContentGenerationRunOutcome, string> = {
  success: "Success",
  skipped: "Skipped",
  failed: "Failed",
};

type AgentRunOutcomeBadgeProps = {
  /** The run outcome to display as a badge. */
  outcome: ContentGenerationRunOutcome;
};

/**
 * Renders a color-coded badge for a content-generation run outcome.
 *
 * - `success` → green badge
 * - `skipped` → amber/yellow badge
 * - `failed` → red badge
 *
 * @param props - Component props.
 * @param props.outcome - The outcome value to render.
 * @returns A Badge element with the appropriate variant and label.
 */
export const AgentRunOutcomeBadge = ({
  outcome,
}: AgentRunOutcomeBadgeProps) => (
  <Badge variant={OUTCOME_VARIANT_MAP[outcome]}>
    {OUTCOME_LABEL_MAP[outcome]}
  </Badge>
);
