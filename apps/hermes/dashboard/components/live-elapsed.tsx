"use client";

import { formatActivityDuration } from "@/lib/format-activity-duration";

import { useLiveElapsed } from "./use-live-elapsed";

type LiveElapsedProps = {
  startIso: string;
};

/**
 * Displays a live-updating elapsed label for an in-progress activity step.
 *
 * @param props - ISO start time for the active step.
 */
export const LiveElapsed = ({ startIso }: LiveElapsedProps) => {
  const elapsedMs = useLiveElapsed(startIso);

  return (
    <span className="text-xs tabular-nums text-muted-foreground mr-2">
      {formatActivityDuration(elapsedMs)}…
    </span>
  );
};
