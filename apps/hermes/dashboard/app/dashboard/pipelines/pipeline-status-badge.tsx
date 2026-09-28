import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

import { ToneBadge, type StatusTone } from "@/components/status-badge";
import type { PipelineStatus } from "@/lib/pipeline-status";

export type PipelineStatusBadgeProps = {
  status: PipelineStatus;
  warnings?: string[];
};

const PIPELINE_STATUS_BADGE: Record<
  PipelineStatus,
  { tone: StatusTone; label: string }
> = {
  enabled: { tone: "success", label: "Enabled" },
  disabled: { tone: "muted", label: "Disabled" },
  incomplete: { tone: "warning", label: "Incomplete" },
};

export const PipelineStatusBadge = ({
  status,
  warnings = [],
}: PipelineStatusBadgeProps) => {
  const { tone, label } = PIPELINE_STATUS_BADGE[status];
  const badge = <ToneBadge tone={tone}>{label}</ToneBadge>;
  const hasWarnings = status === "incomplete" && warnings.length > 0;

  if (!hasWarnings) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex cursor-help rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {badge}
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-xs text-left">
        <p className="font-medium">Needs attention</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {warnings.map((warning, index) => (
            <li key={`${index}-${warning}`}>{warning}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
};
