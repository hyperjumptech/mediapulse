import type { DetailBlockBadgeVariant } from "@hermes/domain-contract";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

export const mapBadgeVariant = (
  variant: DetailBlockBadgeVariant,
): BadgeVariant => (variant === "muted" ? "secondary" : variant);
