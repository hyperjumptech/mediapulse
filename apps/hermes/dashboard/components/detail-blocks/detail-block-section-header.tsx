import {
  evaluateDetailBlockRule,
  parseDetailBlockRule,
  type DetailBlockSectionRule,
} from "@hermes/domain-contract";

import { ToneBadge } from "@/components/status-badge";

import { mapBadgeTone } from "./map-badge-variant";

export const DetailBlockSectionHeader = ({
  label,
  sectionRule,
  data,
}: {
  label?: string;
  sectionRule?: DetailBlockSectionRule;
  data: unknown;
}) => {
  const matches = sectionRule
    ? evaluateSectionRuleSafely(sectionRule, data)
    : false;
  const showLabel = typeof label === "string" && label.length > 0;
  if (!showLabel && !matches) return null;

  return (
    <div
      data-slot="detail-block-section-header"
      className="flex min-w-0 flex-wrap items-center gap-2"
    >
      {showLabel ? (
        <h2 className="min-w-0 text-base font-semibold break-words text-foreground">
          {label}
        </h2>
      ) : null}
      {matches && sectionRule ? (
        <ToneBadge tone={mapBadgeTone(sectionRule.badge)}>
          {sectionRule.label}
        </ToneBadge>
      ) : null}
    </div>
  );
};

const evaluateSectionRuleSafely = (
  rule: DetailBlockSectionRule,
  data: unknown,
): boolean => {
  try {
    const ast = parseDetailBlockRule(rule.when);

    return evaluateDetailBlockRule(ast, data);
  } catch {
    return false;
  }
};
