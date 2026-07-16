import {
  NEWSLETTER_SECTION_IDS,
  type AnalysisTickerContext,
} from "@workspace/agent-data-api-contract";
import { z } from "zod";

/**
 * Per-article placeholders an inclusion rule may reference. Each is substituted from the article's
 * ticker context at classification time; when the ticker context or the backing field is absent, the
 * placeholder resolves to `fallback` so the rule reads as generic issuer-agnostic text.
 */
export const ACCEPTANCE_CRITERIA_PLACEHOLDERS = [
  { token: "{{TICKER}}", field: "symbol", fallback: "the issuer" },
  { token: "{{TICKER_NAME}}", field: "name", fallback: "the issuer" },
  { token: "{{SECTOR}}", field: "sector", fallback: "overall" },
  {
    token: "{{INDUSTRY}}",
    field: "industry",
    fallback: "the issuer's industry",
  },
  {
    token: "{{SUB_INDUSTRY}}",
    field: "subIndustry",
    fallback: "the issuer's product market",
  },
  {
    token: "{{BUSINESS_ACTIVITY}}",
    field: "businessActivity",
    fallback: "the issuer's business",
  },
] as const satisfies readonly {
  token: string;
  field: keyof AnalysisTickerContext;
  fallback: string;
}[];

/**
 * Substitutes every {@link ACCEPTANCE_CRITERIA_PLACEHOLDERS} token in `text` with the matching field
 * from `ticker`, using the placeholder's fallback when the ticker context or the field value is null.
 *
 * @param text - Inclusion-rule text that may contain placeholders.
 * @param ticker - Per-article ticker context, or `null` for ticker-agnostic articles.
 * @returns The text with all known placeholders resolved.
 */
export const substituteTickerPlaceholders = (
  text: string,
  ticker: AnalysisTickerContext | null,
): string =>
  ACCEPTANCE_CRITERIA_PLACEHOLDERS.reduce(
    (resolved, placeholder) =>
      resolved.replaceAll(
        placeholder.token,
        ticker?.[placeholder.field] ?? placeholder.fallback,
      ),
    text,
  );

const PLACEHOLDER_TOKENS = ACCEPTANCE_CRITERIA_PLACEHOLDERS.map(
  (placeholder) => placeholder.token,
).join(", ");

/** OpenAI-compatible LLM credentials used to classify articles into newsletter sections. */
const acceptanceSchema = z
  .object({
    model: z.string().default("{{AI_MODEL}}"),
    apiKey: z.string().default("{{AI_API_KEY}}"),
    baseUrl: z.string().default("{{AI_BASE_URL}}"),
  })
  .default({})
  .describe("LLM (OpenAI-compatible) credentials used to classify articles.");

/**
 * One inclusion rule the classifier evaluates against an article.
 *
 * `text` is phrased as an instruction ("Include if the article ..."); the model decides per rule
 * whether the article satisfies it (matched true/false). `id` is a stable slug used to reference
 * the rule in the score breakdown and the reason, so it must survive text edits and reorders.
 */
const acceptanceCriterionSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .describe('Stable slug for this rule, e.g. "ip-macro-move".'),
  text: z
    .string()
    .trim()
    .min(1)
    .describe('Inclusion instruction: "Include if the article ...".'),
});

const acceptanceCriteriaRuleSchema = z.object({
  section: z.enum(NEWSLETTER_SECTION_IDS as unknown as [string, ...string[]]),
  criteria: z
    .array(acceptanceCriterionSchema)
    .min(1)
    .describe("Inclusion rules whose matched fraction scores this section."),
});

/**
 * Default inclusion rules, at least five per newsletter section. Operators may edit each rule's
 * text or add and remove rules per section through the agent-config editor; the ids stay stable so
 * persisted score breakdowns keep referencing the same rule.
 */
const DEFAULT_ACCEPTANCE_CRITERIA: readonly {
  section: (typeof NEWSLETTER_SECTION_IDS)[number];
  criteria: readonly { id: string; text: string }[];
}[] = [
  {
    section: "industryPulse",
    criteria: [
      {
        id: "ip-macro-move",
        text: "Include if the article reports a macro or industry-wide development (regulation, demand, pricing, input cost, or supply shift) in {{INDUSTRY}} or a narrower market {{TICKER}} competes in, rather than a single company's own news.",
      },
      {
        id: "ip-industry-specific",
        text: "Include if the development is specific to {{TICKER}}'s own industry or product market ({{INDUSTRY}}, {{SUB_INDUSTRY}}), not merely the broad {{SECTOR}} sector or an adjacent category {{TICKER}} does not operate in.",
      },
      {
        id: "ip-multi-issuer",
        text: "Include if the development affects multiple direct competitors or {{INDUSTRY}} as a whole, not just one company and not the whole economy.",
      },
      {
        id: "ip-forward-impact",
        text: "Include if it carries a clear forward-looking impact on {{INDUSTRY}}'s outlook or on {{TICKER}}'s demand, costs, or competitive conditions.",
      },
      {
        id: "ip-material-to-issuer",
        text: "Include if a reader holding {{TICKER}} would plausibly reassess the issuer because of it.",
      },
      {
        id: "ip-day-significance",
        text: "Include if it is among the most significant developments for {{INDUSTRY}} in the current window.",
      },
      {
        id: "ip-cited-source",
        text: "Include if the claim is grounded in a named, credible source (report, official statement, or reputable outlet).",
      },
    ],
  },
  {
    section: "competitiveLandscape",
    criteria: [
      {
        id: "cl-peer-named",
        text: "Include if the article names at least one direct peer or competitor of {{TICKER}} in {{INDUSTRY}} ({{SUB_INDUSTRY}}).",
      },
      {
        id: "cl-positioning",
        text: "Include if it describes peer positioning, a market-share shift, a win or loss, or a competitive threat in {{TICKER}}'s market.",
      },
      {
        id: "cl-issuer-relevant",
        text: "Include if the competitive move is materially relevant to {{TICKER}}'s own market ({{INDUSTRY}}, {{SUB_INDUSTRY}}), not just the broad {{SECTOR}} sector.",
      },
      {
        id: "cl-comparison",
        text: "Include if it provides a relative dynamic (who gains or loses), not just a standalone company update.",
      },
      {
        id: "cl-recent",
        text: "Include if the competitive development is current, not historical background.",
      },
    ],
  },
  {
    section: "dealsAndMovements",
    criteria: [
      {
        id: "dm-corporate-action",
        text: "Include if the article describes an M&A deal, funding round, IPO, or divestiture.",
      },
      {
        id: "dm-leadership",
        text: "Include if it reports a leadership, executive, or board change.",
      },
      {
        id: "dm-parties-named",
        text: "Include if the parties involved (acquirer, target, investor, or appointee) are named.",
      },
      {
        id: "dm-material",
        text: "Include if the deal or movement is material to {{TICKER}} or its industry ({{INDUSTRY}}, {{SUB_INDUSTRY}}), not the broad {{SECTOR}} sector alone.",
      },
      {
        id: "dm-confirmed",
        text: "Include if the event is officially announced or confirmed, not rumor or speculation.",
      },
    ],
  },
  {
    section: "regulatoryPolicyWatch",
    criteria: [
      {
        id: "rp-regulatory-topic",
        text: "Include if the article concerns licensing, compliance, enforcement, policy, or rulemaking.",
      },
      {
        id: "rp-authority-named",
        text: "Include if a regulator, agency, court, or lawmaker is named as the actor.",
      },
      {
        id: "rp-sector-impact",
        text: "Include if the rule or action affects {{TICKER}}'s industry or product market ({{INDUSTRY}}, {{SUB_INDUSTRY}}), not just the broad {{SECTOR}} sector or an unrelated category.",
      },
      {
        id: "rp-actionable-change",
        text: "Include if it represents a change or pending change (new rule, ruling, penalty, or consultation), not general commentary.",
      },
      {
        id: "rp-cited-source",
        text: "Include if it is grounded in an official filing, statement, or credible report.",
      },
    ],
  },
  {
    section: "disruptorsOrTech",
    criteria: [
      {
        id: "dt-tech-shift",
        text: "Include if the article describes digital disruption, AI adoption, automation, or a technology shift.",
      },
      {
        id: "dt-sector-reshape",
        text: "Include if the technology reshapes how {{INDUSTRY}} operates or competes.",
      },
      {
        id: "dt-concrete",
        text: "Include if it refers to a concrete product, capability, deployment, or adoption event, not vague hype.",
      },
      {
        id: "dt-issuer-sector-relevant",
        text: "Include if it is relevant to {{TICKER}}'s industry or business model ({{INDUSTRY}}, {{BUSINESS_ACTIVITY}}), not the broad {{SECTOR}} sector alone.",
      },
      {
        id: "dt-recent",
        text: "Include if the development is current.",
      },
    ],
  },
  {
    section: "quickHits",
    criteria: [
      {
        id: "qh-cited",
        text: "Include if the article has a citable, credible source.",
      },
      {
        id: "qh-noteworthy",
        text: "Include if it is genuinely noteworthy to a reader of {{INDUSTRY}} or {{TICKER}}'s market.",
      },
      {
        id: "qh-sector-related",
        text: "Include if it relates to {{TICKER}}'s industry or product market ({{INDUSTRY}}, {{SUB_INDUSTRY}}), or a directly adjacent space, not the broad {{SECTOR}} sector alone.",
      },
      {
        id: "qh-concise",
        text: "Include if it can be summarised as a short standalone item.",
      },
      {
        id: "qh-not-elsewhere",
        text: "Include if it does not clearly satisfy the defining criteria of any main section.",
      },
    ],
  },
] as const;

/**
 * One acceptance rule per newsletter section. Defaults seed at least five inclusion rules per
 * section; operators may override the rules per section through the agent-config editor.
 */
const acceptanceCriteriaSchema = z
  .array(acceptanceCriteriaRuleSchema)
  .default(() =>
    DEFAULT_ACCEPTANCE_CRITERIA.map((rule) => ({
      section: rule.section,
      criteria: rule.criteria.map((criterion) => ({ ...criterion })),
    })),
  )
  .describe(
    `Inclusion rules per newsletter section; seeded with at least five per section, operator may override. Rule text may use these per-article placeholders, substituted from the article's ticker context (a missing value falls back to a generic phrase): ${PLACEHOLDER_TOKENS}.`,
  );

export const articleAnalysisConfigSchema = z
  .object({
    acceptance: acceptanceSchema,
    acceptanceCriteria: acceptanceCriteriaSchema,
  })
  .strict();

export type ArticleAnalysisConfig = z.output<
  typeof articleAnalysisConfigSchema
>;
export type AcceptanceCriteriaRule = z.output<
  typeof acceptanceCriteriaRuleSchema
>;
export type AcceptanceCriterion = z.output<typeof acceptanceCriterionSchema>;

/** One inclusion rule flattened with the section it belongs to. */
export type FlatCriterion = {
  id: string;
  section: string;
  text: string;
};

/**
 * Flattens per-section rules into a single list tagged with each rule's section.
 *
 * @param acceptanceCriteria - Per-section rules from agent config.
 * @returns Every criterion as `{ id, section, text }`, in config order.
 */
export const flattenAcceptanceCriteria = (
  acceptanceCriteria: AcceptanceCriteriaRule[],
): FlatCriterion[] =>
  acceptanceCriteria.flatMap((rule) =>
    rule.criteria.map((criterion) => ({
      id: criterion.id,
      section: rule.section,
      text: criterion.text,
    })),
  );
