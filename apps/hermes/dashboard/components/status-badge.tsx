import type { ComponentProps } from "react";

import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending: "muted",
  queued: "muted",
  running: "info",
  succeeded: "success",
  success: "success",
  completed: "success",
  partial: "warning",
  failed: "destructive",
  failure: "destructive",
  cancelled: "muted",
  enabled: "success",
  disabled: "muted",
  active: "success",
  inactive: "muted",
  valid: "success",
  invalid: "warning",
};

const humanizeStatus = (status: string) => status.replaceAll(/[_-]/g, " ");

export const statusBadgeVariant = (status: string): BadgeVariant =>
  STATUS_VARIANTS[status.toLowerCase()] ?? "outline";

export const StatusBadge = ({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) => {
  const variant = statusBadgeVariant(status);
  const text = label ?? humanizeStatus(status);

  return (
    <Badge variant={variant} className={cn("gap-1.5 capitalize", className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {text}
    </Badge>
  );
};
