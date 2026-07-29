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
 * Default inclusion rules, five per newsletter section. Operators may edit each rule's text or add
 * and remove rules per section through the agent-config editor; the ids stay stable so persisted
 * score breakdowns keep referencing the same rule.
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
        text: "Include if the article's main subject is a development affecting {{INDUSTRY}} as a whole, rather than one company's own news.",
      },
      {
        id: "ip-market-named",
        text: "Include if it identifies the affected market by name or unmistakable description ({{INDUSTRY}} or {{SUB_INDUSTRY}}), rather than referring only to the {{SECTOR}} sector or to the economy at large.",
      },
      {
        id: "ip-multi-issuer",
        text: "Include if the effects it describes reach several companies competing in {{INDUSTRY}}, rather than one firm alone.",
      },
      {
        id: "ip-driver-named",
        text: "Include if it names what is driving the development: demand, pricing, input cost, capacity, supply, or policy.",
      },
      {
        id: "ip-forward-impact",
        text: "Include if it states a forward-looking consequence for {{INDUSTRY}}'s demand, costs, or capacity, rather than only what has already happened.",
      },
    ],
  },
  {
    section: "competitiveLandscape",
    criteria: [
      {
        id: "cl-peer-named",
        text: "Include if the article names at least one company other than {{TICKER}} that operates in {{INDUSTRY}} ({{SUB_INDUSTRY}}).",
      },
      {
        id: "cl-peer-action",
        text: "Include if it reports a specific action by that company: a launch, price move, expansion, closure, partnership, contract, capacity change, or campaign.",
      },
      {
        id: "cl-market-overlap",
        text: "Include if the action takes place in a market {{TICKER}} serves: the same product category, the same customer segment, or the same geography.",
      },
      {
        id: "cl-relative-dynamic",
        text: "Include if it states or clearly implies a shift in standing between operators in that market: share, customers, pricing power, or footprint.",
      },
      {
        id: "cl-issuer-side",
        text: "Include if it places {{TICKER}} on one side of that shift, as gaining, losing, or directly pressured.",
      },
    ],
  },
  {
    section: "dealsAndMovements",
    criteria: [
      {
        id: "dm-corporate-action",
        text: "Include if the article reports a specific corporate action: an acquisition, merger, divestiture, funding round, IPO, share issuance, buyback, joint venture, or an appointment to a board or executive role.",
      },
      {
        id: "dm-parties-named",
        text: "Include if it names the parties to that action: acquirer and target, investor and recipient, or the appointee and the role they take.",
      },
      {
        id: "dm-terms-stated",
        text: "Include if it states at least one concrete term of the action: value, stake, price, share count, effective date, or the scope of the role.",
      },
      {
        id: "dm-confirmed",
        text: "Include if a party to the action presents it as announced, agreed, or completed, rather than as rumour, speculation, or an analyst's expectation.",
      },
      {
        id: "dm-market-link",
        text: "Include if the acting party operates in {{INDUSTRY}} ({{SUB_INDUSTRY}}), or the action changes who owns or runs capacity in that market.",
      },
    ],
  },
  {
    section: "regulatoryPolicyWatch",
    criteria: [
      {
        id: "rp-regulatory-topic",
        text: "Include if the article's main subject is a rule, licence, permit, tariff, quota, subsidy, enforcement action, court ruling, or policy governing how companies may operate.",
      },
      {
        id: "rp-authority-named",
        text: "Include if it names the government body, regulator, court, or lawmaker taking or proposing that action.",
      },
      {
        id: "rp-actionable-change",
        text: "Include if it reports a change or proposed change carrying a stated status: issued, revised, enforced, penalised, under consultation, or pending. Commentary on rules already in force does not qualify.",
      },
      {
        id: "rp-instrument-named",
        text: "Include if it identifies the instrument itself by name, number, or programme, rather than referring only to new rules in the abstract.",
      },
      {
        id: "rp-obligation-stated",
        text: "Include if it states what affected companies must now do or stop doing, or what the change will cost them.",
      },
    ],
  },
  {
    section: "disruptorsOrTech",
    criteria: [
      {
        id: "dt-tech-subject",
        text: "Include if the article's main subject is a specific technology, digital platform, automation system, or AI capability.",
      },
      {
        id: "dt-adopter-named",
        text: "Include if it names the organisation building, deploying, supplying, or funding that technology.",
      },
      {
        id: "dt-concrete",
        text: "Include if it identifies what the technology does: the process it replaces, the task it automates, or the capability it adds.",
      },
      {
        id: "dt-deployment-stage",
        text: "Include if it reports a reached stage: live, piloted, contracted, funded, or launched. A stated intention, forecast, or general trend does not qualify.",
      },
      {
        id: "dt-operating-change",
        text: "Include if it states how the technology changes cost, speed, capacity, or how customers are served in {{INDUSTRY}}.",
      },
    ],
  },
  {
    section: "quickHits",
    criteria: [
      {
        id: "qh-not-elsewhere",
        text: "Include if the article's main subject is none of the following: a corporate action, a regulatory action, a competitor's move, a technology deployment, or a development affecting {{INDUSTRY}} as a whole.",
      },
      {
        id: "qh-market-actor",
        text: "Include if it names {{TICKER}}, {{TICKER_NAME}}, or another company operating in {{INDUSTRY}} ({{SUB_INDUSTRY}}).",
      },
      {
        id: "qh-single-fact",
        text: "Include if it reports one specific, self-contained fact: a figure, a date, an award, a ranking, an outlet opening, a sponsorship, or a published result.",
      },
      {
        id: "qh-attributed",
        text: "Include if it attributes that fact to a named company statement, official body, filing, or publication.",
      },
      {
        id: "qh-standalone",
        text: "Include if the fact is intelligible on its own, without prior coverage to make sense of it.",
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
