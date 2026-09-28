import type { DetailBlockBadgeVariant } from "@hermes/domain-contract";

import type { StatusTone } from "@/components/status-badge";

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

const TONE_BY_BADGE_VARIANT: Record<DetailBlockBadgeVariant, StatusTone> = {
  success: "success",
  warning: "warning",
  destructive: "failed",
  muted: "muted",
  outline: "neutral",
};

const isBadgeVariant = (variant: string): variant is DetailBlockBadgeVariant =>
  Object.hasOwn(TONE_BY_BADGE_VARIANT, variant);

export const mapBadgeTone = (variant: string): StatusTone =>
  isBadgeVariant(variant) ? TONE_BY_BADGE_VARIANT[variant] : "neutral";
