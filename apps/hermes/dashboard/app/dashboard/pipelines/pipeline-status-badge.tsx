import { Badge } from "@workspace/ui/components/badge";

import type { PipelineStatus } from "@/lib/pipeline-status";

export type PipelineStatusBadgeProps = {
  /** Derived status from validation and `isActive`. */
  status: PipelineStatus;
};

/**
 * Renders Incomplete, Disabled, or Enabled with the same variants as the pipelines list table.
 */
export const PipelineStatusBadge = ({ status }: PipelineStatusBadgeProps) => {
  const statusLabel =
    status === "incomplete"
      ? "Incomplete"
      : status === "disabled"
        ? "Disabled"
        : "Enabled";
  const badgeVariant =
    status === "incomplete"
      ? "destructive"
      : status === "disabled"
        ? "secondary"
        : "success";
  return <Badge variant={badgeVariant}>{statusLabel}</Badge>;
};
