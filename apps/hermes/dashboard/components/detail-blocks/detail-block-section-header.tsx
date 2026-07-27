import {
  evaluateDetailBlockRule,
  parseDetailBlockRule,
  type DetailBlockSectionRule,
} from "@hermes/domain-contract";

import { Badge } from "@workspace/ui/components/badge";

import { mapBadgeVariant } from "./map-badge-variant";

/**
 * Renders the heading row of a detail block: a label plus an optional
 * data-driven badge. Returns `null` when neither label nor badge applies.
 *
 * @param props.label - Static caption from the manifest.
 * @param props.sectionRule - Optional rule that drives the badge.
 * @param props.data - Detail response, used to evaluate the rule.
 */
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
    <div className="flex items-center gap-2">
      {showLabel ? (
        <h2 className="text-base font-semibold text-foreground">{label}</h2>
      ) : null}
      {matches && sectionRule ? (
        <Badge variant={mapBadgeVariant(sectionRule.badge)}>
          {sectionRule.label}
        </Badge>
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
