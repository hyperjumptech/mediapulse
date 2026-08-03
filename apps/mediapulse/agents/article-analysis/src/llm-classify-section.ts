import { createHash } from "node:crypto";

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type ModelMessage } from "ai";
import {
  applyContractBrief,
  extractLlmUsage,
  type OnLlmUsage,
} from "@workspace/agent-runtime";
import {
  MEDIAPULSE_NEWSLETTER_SECTIONS,
  NEWSLETTER_SECTION_PRECEDENCE,
  type AnalysisTickerContext,
  type PostAnalysisScoreBreakdown,
} from "@workspace/agent-data-api-contract";
import { z } from "zod";

import {
  flattenAcceptanceCriteria,
  substituteTickerPlaceholders,
  type AcceptanceCriteriaRule,
} from "./config-schema.js";

/** Article content past this many characters is truncated before classification. */
export const MAX_CONTENT_CHARS = 12000;

/** Reason strings are capped to this length by the analysis contract. */
const MAX_REASON_CHARS = 2000;

/** Fallback note when the model omits a judgment for a configured rule. */
const MISSING_EVALUATION_NOTE = "No judgment returned; treated as not matched.";

/**
 * Reserved id for the mandatory issuer-relevance gate judgment. Not part of
 * `DEFAULT_ACCEPTANCE_CRITERIA` and not operator-editable — code-owned so it can't be
 * edited away, and structural rather than data-driven so it needs no agent-config migration.
 */
export const ISSUER_RELEVANCE_CRITERION_ID = "gate-issuer-relevance";

/** Fixed instruction text for the issuer-relevance gate (not persisted, not editable). */
const ISSUER_RELEVANCE_CRITERION_TEXT =
  "Include if the article concerns the named issuer, a subsidiary or parent in the issuer's corporate group, a company competing in the issuer's industry, or the conditions under which companies in that industry operate. An article about a competitor or another operator in the issuer's market qualifies even when the issuer itself is never mentioned, and so does one about a group company trading under its own name and exchange symbol. The lists of brands and competitors given above are not exhaustive, so do not reject an article merely because the company it names is absent from them. Exclude when the match is coincidental: a different entity, place, or topic that happens to share the ticker symbol, the company name, or a similar brand. Exclude too when the article is about another country's market: a foreign regulator's rule, a foreign company's results, or demand and pricing in a market the issuer does not serve. A same-industry company abroad is a coincidental match, not a competitor, unless the article ties it to the issuer's own market through trade, supply, ownership, or a stated effect there. World prices for a commodity the issuer produces or buys are the issuer's market and are not foreign.";

/**
 * The issuer-relevance rule id in each section of `DEFAULT_ACCEPTANCE_CRITERIA`. Code-owned like the
 * global gate so it needs no agent-config migration: when the winning section earns its score on
 * issuer-agnostic rules while its issuer-relevance rule is unmatched, the fit score is capped. This
 * corroborates the single global gate boolean (which the model can false-positive on a coincidental
 * venue or keyword match) with a second judgment the model already makes. `industryPulse` is
 * macro/sector-wide by design and has no issuer-specific rule, and after the criteria rework
 * `regulatoryPolicyWatch` has none either. A custom config that renames these ids skips the cap.
 *
 * - Important: these ids must track `DEFAULT_ACCEPTANCE_CRITERIA`. They silently went stale once
 *   already, which disabled the cap entirely; `llm-classify-section.test.ts` now pins them.
 */
export const ISSUER_RELEVANCE_RULE_IDS: ReadonlySet<string> = new Set([
  "cl-issuer-side",
  "dm-market-link",
  "dt-operating-change",
  "qh-market-actor",
]);

/**
 * Fit-score ceiling for a section won on issuer-agnostic rules while its issuer-relevance rule is
 * unmatched.
 *
 * - Important: content-generation applies no minimum score, so this only de-ranks the item within
 *   its section (`select-articles.ts` sorts by score and keeps the top N). It does not stop the item
 *   shipping. An earlier comment here claimed a 0.7 ship line in content-generation; no such
 *   threshold exists.
 */
export const ISSUER_UNMATCHED_SCORE_CAP = 0.4;

/** One per-rule judgment returned by the model. */
export type CriterionEvaluation = {
  id: string;
  matched: boolean;
  note: string;
};

/**
 * The deterministic classification derived from the model's per-rule judgments: the winning section
 * (or `null` to reject), the computed fit score, a code-composed reason, and the full breakdown.
 */
export type ArticleSectionClassification = {
  section: string | null;
  score: number;
  reason: string;
  scoreBreakdown: PostAnalysisScoreBreakdown;
};

/**
 * Builds the model output schema for one classification, constraining rule ids to the configured
 * set so the model cannot reference an unknown rule.
 *
 * @param criterionIds - Every configured rule id (deduplicated).
 * @returns A zod object schema requiring one `{ id, matched, note }` judgment per rule.
 */
export const buildEvaluationSchema = (criterionIds: string[]) =>
  z.object({
    evaluations: z.array(
      z.object({
        id: z.enum(criterionIds as unknown as [string, ...string[]]),
        matched: z.boolean(),
        note: z.string().trim().min(1).max(240),
      }),
    ),
  });

const SYSTEM_PROMPT = [
  "You are an editorial classifier for an industry newsletter.",
  'Each criterion is an inclusion rule phrased as "Include if the article ...".',
  "For EACH rule decide whether the article satisfies its condition (matched true or false).",
  "In the note, cite the specific article detail that satisfies the rule (for a match) or state",
  "what is missing (for a miss) — do not restate the rule.",
  "Do NOT choose a section or a score; those are computed from your judgments.",
  "Judge every rule independently and return exactly one judgment per rule.",
  "When a mandatory issuer-relevance gate rule is present, judge it exactly like any other rule:",
  "true when the article concerns the issuer, one of its competitors, or the conditions of the",
  "market they share, and false on a coincidental keyword or name match, or when the article's",
  "subject is another country's market with no stated tie to the issuer's own.",
].join(" ");

/**
 * Renders the inclusion rules grouped by section (with each section's human label) for the prompt,
 * substituting each rule's ticker placeholders from `ticker` (fallbacks apply when it is `null`).
 *
 * @param acceptanceCriteria - Per-section rules from agent config.
 * @param ticker - Per-article ticker context, or `null` for ticker-agnostic articles.
 * @returns A prompt block listing each section and its `- <id>: <text>` rules.
 */
const renderCriteria = (
  acceptanceCriteria: AcceptanceCriteriaRule[],
  ticker: AnalysisTickerContext | null,
): string => {
  const labelById = new Map<string, string>(
    MEDIAPULSE_NEWSLETTER_SECTIONS.map((section) => [
      section.id,
      section.label,
    ]),
  );

  return acceptanceCriteria
    .map((rule) => {
      const label = labelById.get(rule.section) ?? rule.section;
      const rules = rule.criteria
        .map(
          (criterion) =>
            `  - ${criterion.id}: ${substituteTickerPlaceholders(criterion.text, ticker)}`,
        )
        .join("\n");

      return `${rule.section} (${label}):\n${rules}`;
    })
    .join("\n\n");
};

/**
 * Renders the issuer the article was collected for into a one-line prompt block.
 *
 * @param ticker - Per-article ticker context from `analysis.get`, or `null` when ticker-agnostic.
 * @returns A single context line, or `null` when there is no issuer to describe.
 */
export const renderArticleTickerContext = (
  ticker: AnalysisTickerContext | null,
): string | null => {
  if (ticker === null) {
    return null;
  }

  const descriptors: string[] = [];
  if (ticker.sector) {
    descriptors.push(`sector ${ticker.sector}`);
  }
  if (ticker.industry) {
    descriptors.push(`industry ${ticker.industry}`);
  }
  if (ticker.subIndustry) {
    descriptors.push(`sub-industry ${ticker.subIndustry}`);
  }
  if (ticker.businessActivity) {
    descriptors.push(`main business ${ticker.businessActivity}`);
  }
  const descriptorText =
    descriptors.length > 0 ? ` — ${descriptors.join(", ")}` : "";

  const lines = [
    `Issuer context: this article was collected for ${ticker.symbol} (${ticker.name})${descriptorText}. Newsletter sections are defined relative to this issuer and its industry.`,
    `${ticker.symbol} is listed on the Indonesia Stock Exchange and its home market is Indonesia. Judge every rule about a market, a regulator, or a competitor against that market unless the article ties another country to it.`,
  ];

  if (ticker.aliases.length > 0) {
    lines.push(
      `The issuer also trades under these names, brands, and subsidiaries: ${ticker.aliases.join(", ")}. News about any of them is news about ${ticker.symbol} itself, not about a competitor. This list names only the best-known ones: a subsidiary, parent, or other company in the same corporate group counts as the issuer even when it is absent here and is listed separately on the exchange under its own symbol.`,
    );
  }

  if (ticker.competitors.length > 0) {
    const peers = ticker.competitors.map((competitor) =>
      competitor.aliases.length > 0
        ? `${competitor.name} (${competitor.aliases.join(", ")})`
        : competitor.name,
    );
    lines.push(
      `Known competitors of the issuer: ${peers.join("; ")}. Other operators in the same market count as competitors too, even when absent from this list.`,
    );
  }

  return lines.join("\n");
};

/**
 * Builds the chat messages for one article classification call.
 *
 * @param params - Article title/content, the acceptance criteria, and optional issuer context.
 * @returns System + user messages for `generateObject`.
 */
export const buildSectionClassificationMessages = (params: {
  title: string;
  content: string;
  acceptanceCriteria: AcceptanceCriteriaRule[];
  ticker?: AnalysisTickerContext | null;
  tickerContext?: string;
  brief?: string;
}): ModelMessage[] => {
  const truncatedContent = params.content.slice(0, MAX_CONTENT_CHARS);
  const systemPrompt = applyContractBrief(
    SYSTEM_PROMPT,
    params.brief !== undefined ? { brief: params.brief } : undefined,
  );
  const userContent = [
    "Newsletter sections and inclusion rules:",
    renderCriteria(params.acceptanceCriteria, params.ticker ?? null),
    "",
    ...(params.tickerContext
      ? [
          params.tickerContext,
          `Mandatory gate — ${ISSUER_RELEVANCE_CRITERION_ID}: ${ISSUER_RELEVANCE_CRITERION_TEXT}`,
          "",
        ]
      : []),
    `Article title: ${params.title}`,
    "",
    "Article content:",
    truncatedContent,
  ].join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];
};

/**
 * Hashes the inclusion-rule set so persisted breakdowns record which criteria version scored them.
 *
 * @param acceptanceCriteria - Per-section rules from agent config.
 * @returns A short hex digest over the section/id/text/qualifying of every rule, in config order.
 */
export const criteriaHash = (
  acceptanceCriteria: AcceptanceCriteriaRule[],
): string => {
  const canonical = flattenAcceptanceCriteria(acceptanceCriteria).map(
    (criterion) => [
      criterion.section,
      criterion.id,
      criterion.text,
      criterion.qualifying,
    ],
  );

  return createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex")
    .slice(0, 12);
};

/**
 * Truncates a composed reason to the contract limit without dropping below one character.
 *
 * @param reason - The composed reason.
 * @returns The reason capped at {@link MAX_REASON_CHARS}.
 */
const capReason = (reason: string): string =>
  reason.length > MAX_REASON_CHARS ? reason.slice(0, MAX_REASON_CHARS) : reason;

/**
 * Derives the section, score, reason, and breakdown from the model's per-rule judgments.
 *
 * Scoring is fully deterministic: each section's score is `matched / total` of its rules, the
 * winning section is the one with the highest matched fraction (ties broken by canonical display
 * order), and an article that matches no rule in any section is rejected (`section: null`).
 *
 * @param evaluations - Per-rule judgments from the model (missing rules count as not matched).
 * @param acceptanceCriteria - The per-section rules the judgments were made against.
 * @param requireIssuerRelevance - When true, rejects unless the model's judgment for
 *   {@link ISSUER_RELEVANCE_CRITERION_ID} is explicitly `matched: true` — fails closed if the
 *   judgment is missing. Defaults to `false` for backward compatibility.
 * @returns The deterministic classification with a self-describing score breakdown carrying every
 *   rule's judgment across all sections, not only the winning one.
 */
export const scoreFromEvaluations = (
  evaluations: CriterionEvaluation[],
  acceptanceCriteria: AcceptanceCriteriaRule[],
  requireIssuerRelevance = false,
): ArticleSectionClassification => {
  const flat = flattenAcceptanceCriteria(acceptanceCriteria);
  const evaluationById = new Map<string, CriterionEvaluation>(
    evaluations.map((evaluation) => [evaluation.id, evaluation]),
  );
  const labelById = new Map<string, string>(
    MEDIAPULSE_NEWSLETTER_SECTIONS.map((section) => [
      section.id,
      section.label,
    ]),
  );

  const isMatched = (id: string): boolean =>
    evaluationById.get(id)?.matched === true;
  const noteFor = (id: string): string =>
    evaluationById.get(id)?.note ?? MISSING_EVALUATION_NOTE;

  // Per-section tallies in specificity order, so every tie-break prefers the narrower section over
  // a catch-all. Sections absent from the config are skipped.
  const presentSections = NEWSLETTER_SECTION_PRECEDENCE.filter((sectionId) =>
    flat.some((criterion) => criterion.section === sectionId),
  );

  const tallies = presentSections.map((sectionId) => {
    const sectionCriteria = flat.filter(
      (criterion) => criterion.section === sectionId,
    );
    const gate = sectionCriteria.filter((criterion) => criterion.qualifying);
    const total = sectionCriteria.length;
    const matched = sectionCriteria.filter((criterion) =>
      isMatched(criterion.id),
    ).length;

    return {
      section: sectionId,
      matched,
      total,
      fraction: total > 0 ? matched / total : 0,
      hasGate: gate.length > 0,
      // A section with no gate can never qualify; the fallback below covers configs that define none.
      qualified:
        gate.length > 0 && gate.every((criterion) => isMatched(criterion.id)),
    };
  });

  // A section's gate says whether the article is that kind of story at all, so the narrowest
  // qualifying section wins outright. Matched fraction never decides the section: sections differ in
  // how demanding their rules are, so comparing fractions across them systematically favours
  // whichever section is easiest to satisfy rather than whichever fits.
  const qualified = tallies.filter((tally) => tally.qualified);
  const anyGateDefined = tallies.some((tally) => tally.hasGate);

  // Configs that mark no qualifying rules (an operator override predating gates) keep the original
  // behaviour: highest matched fraction wins, now tie-broken by specificity rather than display order.
  //
  // Where gates do exist, an article that clears none of them is not the kind of story any section
  // is for. Ranking it on matched fraction used to admit it anyway, which is how single-rule items
  // ("authority named", nothing else) reached newsletters carrying no fact at all.
  let winner = qualified[0];
  if (winner === undefined && !anyGateDefined) {
    for (const tally of tallies) {
      if (winner === undefined || tally.fraction > winner.fraction) {
        winner = tally;
      }
    }
  }

  const sections = tallies.map((tally) => ({
    section: tally.section,
    matched: tally.matched,
    total: tally.total,
    qualified: tally.qualified,
  }));
  const hash = criteriaHash(acceptanceCriteria);
  const criteriaBreakdown = flat.map((criterion) => ({
    id: criterion.id,
    section: criterion.section,
    text: criterion.text,
    qualifying: criterion.qualifying,
    matched: isMatched(criterion.id),
    note: noteFor(criterion.id),
  }));

  // Mandatory issuer-relevance gate: fail closed if required and not explicitly matched
  // true (including when the model omits the judgment), regardless of how many generic
  // per-section criteria the article superficially satisfies elsewhere.
  const issuerRelevanceRejected =
    requireIssuerRelevance && !isMatched(ISSUER_RELEVANCE_CRITERION_ID);

  // No section qualified, no rule matched anywhere, or the issuer-relevance gate failed: reject.
  const noSectionQualified = winner === undefined && anyGateDefined;
  if (issuerRelevanceRejected || winner === undefined || winner.matched === 0) {
    return {
      section: null,
      score: 0,
      reason: issuerRelevanceRejected
        ? `Rejected — not relevant to issuer context: ${noteFor(ISSUER_RELEVANCE_CRITERION_ID)}.`
        : noSectionQualified
          ? "No section met its qualifying rules; rejected."
          : "No inclusion rule matched in any section; rejected.",
      scoreBreakdown: {
        section: null,
        matched: 0,
        total: 0,
        criteriaHash: hash,
        criteria: criteriaBreakdown,
        sections,
      },
    };
  }

  const winnerCriteria = criteriaBreakdown.filter(
    (criterion) => criterion.section === winner.section,
  );

  // Corroborate the global issuer gate with the winning section's own issuer-relevance rule: an
  // article that won a section on issuer-agnostic rules while this rule is unmatched is on-topic but
  // issuer-irrelevant, so cap its fit score below the ship line without changing the section choice.
  const winnerIssuerRule = winnerCriteria.find((criterion) =>
    ISSUER_RELEVANCE_RULE_IDS.has(criterion.id),
  );
  const issuerRelevanceUnmatched =
    winnerIssuerRule !== undefined && !isMatched(winnerIssuerRule.id);
  const score = issuerRelevanceUnmatched
    ? Math.min(winner.fraction, ISSUER_UNMATCHED_SCORE_CAP)
    : winner.fraction;

  const label = labelById.get(winner.section) ?? winner.section;
  const matchedIds = winnerCriteria
    .filter((criterion) => criterion.matched)
    .map((criterion) => criterion.id);
  const missed = winnerCriteria.filter((criterion) => !criterion.matched);
  const matchedText =
    matchedIds.length > 0 ? ` (${matchedIds.join(", ")})` : "";
  const missedText =
    missed.length > 0
      ? ` Missed: ${missed
          .map((criterion) => `${criterion.id} (${criterion.note})`)
          .join(", ")}.`
      : "";
  const issuerCapText =
    issuerRelevanceUnmatched && winnerIssuerRule !== undefined
      ? ` Issuer-relevance rule ${winnerIssuerRule.id} unmatched; fit score capped at ${ISSUER_UNMATCHED_SCORE_CAP.toFixed(2)}.`
      : "";
  const runnersUp = qualified
    .filter((tally) => tally.section !== winner.section)
    .map((tally) => tally.section);
  const selectionText = winner.qualified
    ? ` Chosen as the most specific qualifying section${runnersUp.length > 0 ? ` over ${runnersUp.join(", ")}` : ""}.`
    : " No section met its qualifying rules; chosen on matched fraction.";
  const reason = capReason(
    `${label} — matched ${winner.matched}/${winner.total}${matchedText}.${selectionText}${missedText}${issuerCapText}`,
  );

  return {
    section: winner.section,
    score,
    reason,
    scoreBreakdown: {
      section: winner.section,
      matched: winner.matched,
      total: winner.total,
      criteriaHash: hash,
      criteria: criteriaBreakdown,
      sections,
    },
  };
};

export const rejectEmptySource = (
  acceptanceCriteria: AcceptanceCriteriaRule[],
): ArticleSectionClassification => ({
  section: null,
  score: 0,
  reason: "Rejected — no description or content to classify.",
  scoreBreakdown: {
    section: null,
    matched: 0,
    total: 0,
    criteriaHash: criteriaHash(acceptanceCriteria),
    criteria: [],
    sections: [],
  },
});

/**
 * Classifies a single article into one newsletter section (or rejects it) with a computed score.
 *
 * The model only judges each inclusion rule as matched or not; the section, score, reason, and
 * breakdown are computed deterministically by {@link scoreFromEvaluations}.
 *
 * @param params - LLM credentials, the article, and the acceptance criteria.
 * @returns The deterministic classification.
 */
export const classifyArticleSection = async (params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  title: string;
  content: string;
  acceptanceCriteria: AcceptanceCriteriaRule[];
  ticker?: AnalysisTickerContext | null;
  tickerContext?: string;
  brief?: string;
  /** Chronicle instrumentation: invoked with token usage per classification. */
  onUsage?: OnLlmUsage;
}): Promise<ArticleSectionClassification> => {
  const openai = createOpenAI({
    apiKey: params.apiKey,
    baseURL: params.baseUrl,
  });

  const requireIssuerRelevance = params.tickerContext !== undefined;
  const criterionIds = [
    ...new Set(
      flattenAcceptanceCriteria(params.acceptanceCriteria).map(
        (criterion) => criterion.id,
      ),
    ),
    ...(requireIssuerRelevance ? [ISSUER_RELEVANCE_CRITERION_ID] : []),
  ];

  const result = await generateObject({
    model: openai(params.model),
    schema: buildEvaluationSchema(criterionIds),
    messages: buildSectionClassificationMessages({
      title: params.title,
      content: params.content,
      acceptanceCriteria: params.acceptanceCriteria,
      ticker: params.ticker ?? null,
      ...(params.tickerContext ? { tickerContext: params.tickerContext } : {}),
      ...(params.brief !== undefined ? { brief: params.brief } : {}),
    }),
  });
  const usage = extractLlmUsage(result.usage);
  if (usage !== undefined) {
    params.onUsage?.(usage);
  }

  return scoreFromEvaluations(
    result.object.evaluations,
    params.acceptanceCriteria,
    requireIssuerRelevance,
  );
};
