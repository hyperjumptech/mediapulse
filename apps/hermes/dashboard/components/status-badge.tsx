import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Circle,
  CircleCheck,
  CircleMinus,
  CircleX,
  Loader,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";

export type StatusTone =
  | "success"
  | "progress"
  | "failed"
  | "warning"
  | "muted"
  | "neutral";

const STATUS_TONES: Record<string, StatusTone> = {
  pending: "progress",
  queued: "progress",
  running: "progress",
  succeeded: "success",
  success: "success",
  completed: "success",
  enabled: "success",
  active: "success",
  valid: "success",
  partial: "warning",
  invalid: "warning",
  failed: "failed",
  failure: "failed",
  cancelled: "muted",
  skipped: "muted",
  disabled: "muted",
  inactive: "muted",
};

const TONE_ICONS: Record<StatusTone, { icon: LucideIcon; className: string }> =
  {
    success: {
      icon: CircleCheck,
      className: "fill-green-500 stroke-background dark:fill-green-400",
    },
    progress: { icon: Loader, className: "" },
    failed: {
      icon: CircleX,
      className: "fill-red-500 stroke-background dark:fill-red-400",
    },
    warning: {
      icon: TriangleAlert,
      className: "fill-amber-500 stroke-background dark:fill-amber-400",
    },
    muted: { icon: CircleMinus, className: "" },
    neutral: { icon: Circle, className: "" },
  };

const humanizeStatus = (status: string) => status.replaceAll(/[_-]/g, " ");

export const statusTone = (status: string): StatusTone =>
  STATUS_TONES[status.toLowerCase()] ?? "neutral";

export const ToneBadge = ({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) => {
  const { icon: Icon, className: iconClassName } = TONE_ICONS[tone];

  return (
    <Badge
      variant="outline"
      data-tone={tone}
      className={cn("px-1.5 text-muted-foreground", className)}
    >
      <Icon aria-hidden className={iconClassName} />
      {children}
    </Badge>
  );
};

export const StatusBadge = ({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) => (
  <ToneBadge tone={statusTone(status)} className={cn("capitalize", className)}>
    {label ?? humanizeStatus(status)}
  </ToneBadge>
);
