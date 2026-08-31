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
  {
    token: "{{ALIASES}}",
    field: "aliases",
    fallback: "no other known trading names",
  },
  {
    token: "{{COMPETITORS}}",
    field: "competitors",
    fallback: "no named peers on file",
  },
  {
    token: "{{REGULATORS}}",
    field: "regulators",
    fallback: "no named regulators on file",
  },
] as const satisfies readonly {
  token: string;
  field: keyof AnalysisTickerContext;
  fallback: string;
}[];

/**
 * Renders one ticker-context field as the plain text a rule should read.
 *
 * List fields render as a comma-separated enumeration, with each peer followed by the spellings it
 * appears under in the press, so a rule can match a name the article actually uses.
 *
 * @param value - The raw field value from the ticker context.
 * @returns The rendered text, or `null` when the field carries nothing usable.
 */
const renderPlaceholderValue = (
  value: AnalysisTickerContext[keyof AnalysisTickerContext],
): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value.length > 0 ? value : null;
  }
  if (value.length === 0) {
    return null;
  }

  const rendered = value.map((entry) => {
    if (typeof entry === "string") {
      return entry;
    }

    return entry.aliases.length > 0
      ? `${entry.name} (${entry.aliases.join(", ")})`
      : entry.name;
  });

  return rendered.join(", ");
};

/**
 * Substitutes every {@link ACCEPTANCE_CRITERIA_PLACEHOLDERS} token in `text` with the matching field
 * from `ticker`, using the placeholder's fallback when the ticker context or the field value is empty.
 *
 * @param text - Inclusion-rule text that may contain placeholders.
 * @param ticker - Per-article ticker context, or `null` for ticker-agnostic articles.
 * @returns The text with all known placeholders resolved.
 */
export const substituteTickerPlaceholders = (
  text: string,
  ticker: AnalysisTickerContext | null,
): string =>
  ACCEPTANCE_CRITERIA_PLACEHOLDERS.reduce((resolved, placeholder) => {
    const rendered =
      ticker === null
        ? null
        : renderPlaceholderValue(ticker[placeholder.field]);

    return resolved.replaceAll(
      placeholder.token,
      rendered ?? placeholder.fallback,
    );
  }, text);

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
  qualifying: z
    .boolean()
    .default(false)
    .describe(
      "When true, this rule defines what kind of story the section is for: the section only competes for an article when every one of its qualifying rules matched. Non-qualifying rules only add strength, which ranks articles inside the section.",
    ),
});

const acceptanceCriteriaRuleSchema = z.object({
  section: z.enum(NEWSLETTER_SECTION_IDS as unknown as [string, ...string[]]),
  criteria: z
    .array(acceptanceCriterionSchema)
    .min(1)
    .describe("Inclusion rules whose matched fraction scores this section."),
});

/**
 * Default inclusion rules, four to six per newsletter section. Operators may edit each rule's text or add
 * and remove rules per section through the agent-config editor; the ids stay stable so persisted
 * score breakdowns keep referencing the same rule.
 *
 * Each section marks the two or three rules that define what kind of story it is for as
 * `qualifying`. Those form the section's gate: the section competes for an article only when all of
 * them match. The remaining rules add strength, which ranks articles within the section but never
 * decides which section wins. Gate rules are chosen to be ones that reliably fire on a genuine story
 * of that kind, so a section is never blocked by a rule its own source material rarely satisfies.
 */
const DEFAULT_ACCEPTANCE_CRITERIA: readonly {
  section: (typeof NEWSLETTER_SECTION_IDS)[number];
  criteria: readonly { id: string; text: string; qualifying?: boolean }[];
}[] = [
  {
    section: "industryPulse",
    criteria: [
      {
        id: "ip-macro-move",
        text: "Include if the article's main subject is a development affecting {{INDUSTRY}} as a whole, rather than one company's own news.",
        qualifying: true,
      },
      {
        id: "ip-market-named",
        text: "Include if it identifies the affected market by name or unmistakable description ({{INDUSTRY}} or {{SUB_INDUSTRY}}), rather than referring only to the {{SECTOR}} sector or to the economy at large.",
        qualifying: true,
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
    section: "issuerPerformance",
    criteria: [
      {
        id: "pf-issuer-subject",
        text: "Include if the article's main subject is {{TICKER}}, {{TICKER_NAME}}, or one of its own trading names, brands, or subsidiaries ({{ALIASES}}), rather than a peer or the market at large. A company in {{TICKER_NAME}}'s corporate group counts as the issuer even when it is listed separately under its own symbol.",
        qualifying: true,
      },
      {
        id: "pf-reported-result",
        text: "Include if it reports a published operating or financial result for that issuer: revenue, profit, margin, production or sales volume, subscriber or outlet count, loan or deposit balance, guidance, or a dividend or payout decision. An analyst's target price, a share-price move, or a stock recommendation is not a reported result.",
        qualifying: true,
      },
      {
        id: "pf-period-stated",
        text: "Include if it names the period the figures cover: a quarter, a half year, a full year, or a stated month.",
      },
      {
        id: "pf-direction-given",
        text: "Include if it states how a figure moved against a prior period: a percentage change, a prior-period comparison, or an explicit rise, fall, or flat reading.",
      },
    ],
  },
  {
    section: "issuerNews",
    criteria: [
      {
        id: "in-issuer-subject",
        text: "Include if the article's main subject is {{TICKER}}, {{TICKER_NAME}}, or one of its own trading names, brands, or subsidiaries ({{ALIASES}}), rather than a peer or the market at large. A company in {{TICKER_NAME}}'s corporate group counts as the issuer even when it is listed separately under its own symbol.",
        qualifying: true,
      },
      {
        id: "in-material-development",
        text: "Include if it reports a material development at that issuer other than a published operating or financial result: a move in its share price, its trading volume, or its inclusion in or removal from an index; regulatory, supervisory, or legal action naming it; an executive of the issuer speaking on its strategy, capacity, capital spending, or outlook; or a launch, campaign, partnership, contract, licence, or expansion it announces. An article whose subject is the issuer's own reported figures belongs to issuerPerformance, so answer false here for revenue, profit, margin, volume, guidance, or a payout decision.",
        qualifying: true,
      },
      {
        id: "in-specific-detail",
        text: "Include if it gives at least one concrete detail of that development: a figure, a date, a named party, a named venue or market, or a stated decision. An article that only asserts the issuer is doing well or badly, with nothing to check, does not qualify.",
      },
      {
        id: "in-consequence-stated",
        text: "Include if it states what the development means for the issuer: a cost, a constraint, an opportunity, an effect on its shares, or a response it has made or plans.",
      },
    ],
  },
  {
    section: "competitiveLandscape",
    criteria: [
      {
        id: "cl-peer-named",
        text: "Include if the article names a company that competes with {{TICKER}} in {{INDUSTRY}} ({{SUB_INDUSTRY}}). Known peers: {{COMPETITORS}}. Any other operator in that market also counts. {{TICKER_NAME}}'s own trading names, brands, and subsidiaries ({{ALIASES}}) are the issuer itself, never a peer.",
        qualifying: true,
      },
      {
        id: "cl-peer-action",
        text: "Include if it reports a specific action by that peer: a launch, price move, expansion, closure, partnership, contract, capacity change, campaign, earnings result, or a licence, spectrum, or tender it won.",
        qualifying: true,
      },
      {
        id: "cl-market-overlap",
        text: "Include if the action takes place in a market {{TICKER}} serves: the same product category, the same customer segment, or the same geography.",
        qualifying: true,
      },
      {
        id: "cl-relative-dynamic",
        text: "Include if the facts reported amount to a shift in standing between operators in that market: share, customers, pricing power, capacity, spectrum, or footprint. Judge this from what the article reports, not from whether it spells the shift out. A peer gaining or losing any of these relative to the others qualifies.",
      },
      {
        id: "cl-issuer-side",
        text: "Include if {{TICKER}} is on one side of that shift, as gaining, losing, or under added pressure. This follows whenever the peer's move lands in a market {{TICKER}} serves, whether or not the article names {{TICKER}} or draws the comparison itself.",
      },
    ],
  },
  {
    section: "dealsAndMovements",
    criteria: [
      {
        id: "dm-corporate-action",
        text: "Include if the article reports a specific corporate action: an acquisition, merger, divestiture, funding round, IPO, share issuance, buyback, joint venture, or an appointment to a board or executive role. A company winning a licence, spectrum block, tender, permit, or government contract is not a corporate action, nor is an ordinary commercial launch, expansion, or earnings result. An article whose subject is a company's own reported figures belongs to issuerPerformance or competitiveLandscape, so answer false here even when those figures are described as a milestone, a record, or a transformation.",
        qualifying: true,
      },
      {
        id: "dm-parties-named",
        text: "Include if it names the companies on each side of that action: acquirer and target, investor and recipient, the partners to the venture, or the appointee and the role they take. A regulator, ministry, or court running a process is not a party to a corporate action.",
        qualifying: true,
      },
      {
        id: "dm-terms-stated",
        text: "Include if it gives at least one detail of the action beyond the fact that it happened: a value, stake, price, share count, timing, or the scope of the role. An approximate or partial figure counts, and so does a stated timeframe such as this quarter or next year.",
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
        qualifying: true,
      },
      {
        id: "rp-authority-named",
        text: "Include if it names the government body, regulator, court, or lawmaker taking or proposing that action.",
        qualifying: true,
      },
      {
        id: "rp-actionable-change",
        text: "Include if it reports a change or proposed change carrying a stated status: issued, revised, enforced, penalised, under consultation, drafted, or pending. Commentary on rules already in force does not qualify.",
      },
      {
        id: "rp-instrument-named",
        text: "Include if the rule, bill, programme, or decision can be identified from the article, whether by formal number, by its common name, or by the authority and subject together. It need not carry an official citation.",
      },
      {
        id: "rp-obligation-stated",
        text: "Include if the article conveys what the change means for affected companies: what they must do or stop doing, what it will cost them, or which of their activities it governs. An obligation clear from what is reported counts even when no duty is spelled out.",
      },
      {
        id: "rp-market-scope",
        text: "Include if the rule, programme, or decision governs how companies operating in {{INDUSTRY}} ({{SUB_INDUSTRY}}) may operate, or is taken by a body with authority over that market ({{REGULATORS}}). Judge the market from the issuer's business ({{BUSINESS_ACTIVITY}}), not from whether the article uses that exact wording. The article need not name {{TICKER}} or any competitor.",
      },
    ],
  },
  {
    section: "disruptorsOrTech",
    criteria: [
      {
        id: "dt-tech-subject",
        text: "Include if the article's main subject is a specific technology, digital platform, automation system, or AI capability.",
        qualifying: true,
      },
      {
        id: "dt-adopter-named",
        text: "Include if it names the organisation building, deploying, supplying, or funding that technology.",
        qualifying: true,
      },
      {
        id: "dt-concrete",
        text: "Include if it identifies what the technology does: the process it replaces, the task it automates, or the capability it adds.",
      },
      {
        id: "dt-deployment-stage",
        text: "Include if the technology has moved beyond an idea: it is live, piloted, contracted, funded, launched, announced for rollout, or being built under a named partnership. A forecast or a general trend with no organisation behind it does not qualify.",
      },
      {
        id: "dt-operating-change",
        text: "Include if the article conveys how the technology changes cost, speed, capacity, reach, or how customers are served in {{INDUSTRY}}. A change evident from what is reported counts even when no figure is given.",
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
        qualifying: true,
      },
      {
        id: "qh-single-fact",
        text: "Include if it reports one specific, self-contained fact: a figure, a date, an award, a ranking, an outlet opening, a sponsorship, or a published result.",
        qualifying: true,
      },
      {
        id: "qh-attributed",
        text: "Include if the fact can be traced to its source from the article: a named company statement, an official body, a filing, a publication, or the reporting outlet itself.",
      },
      {
        id: "qh-standalone",
        text: "Include if the fact is intelligible on its own, without prior coverage to make sense of it.",
      },
    ],
  },
] as const;

/**
 * One acceptance rule per newsletter section. Defaults seed at least four inclusion rules per
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
    `Inclusion rules per newsletter section; seeded with at least four per section, operator may override. Rule text may use these per-article placeholders, substituted from the article's ticker context (a missing value falls back to a generic phrase): ${PLACEHOLDER_TOKENS}.`,
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
  qualifying: boolean;
};

/**
 * Flattens per-section rules into a single list tagged with each rule's section.
 *
 * @param acceptanceCriteria - Per-section rules from agent config.
 * @returns Every criterion as `{ id, section, text, qualifying }`, in config order.
 */
export const flattenAcceptanceCriteria = (
  acceptanceCriteria: AcceptanceCriteriaRule[],
): FlatCriterion[] =>
  acceptanceCriteria.flatMap((rule) =>
    rule.criteria.map((criterion) => ({
      id: criterion.id,
      section: rule.section,
      text: criterion.text,
      qualifying: criterion.qualifying,
    })),
  );
