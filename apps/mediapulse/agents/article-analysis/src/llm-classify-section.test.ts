import { describe, expect, it } from "vitest";

import type { AcceptanceCriteriaRule } from "./config-schema.js";
import {
  buildEvaluationSchema,
  buildSectionClassificationMessages,
  criteriaHash,
  ISSUER_RELEVANCE_CRITERION_ID,
  MAX_CONTENT_CHARS,
  rejectEmptySource,
  renderArticleTickerContext,
  scoreFromEvaluations,
  type CriterionEvaluation,
} from "./llm-classify-section.js";

/** Two sections, five rules each, in canonical display order (industryPulse before competitive). */
const criteria: AcceptanceCriteriaRule[] = [
  {
    section: "industryPulse",
    criteria: [
      { id: "ip1", text: "Include if macro." },
      { id: "ip2", text: "Include if multi-issuer." },
      { id: "ip3", text: "Include if significant." },
      { id: "ip4", text: "Include if forward-looking." },
      { id: "ip5", text: "Include if cited." },
    ],
  },
  {
    section: "competitiveLandscape",
    criteria: [
      { id: "cl1", text: "Include if a peer is named." },
      { id: "cl2", text: "Include if positioning shifts." },
      { id: "cl3", text: "Include if issuer-relevant." },
      { id: "cl4", text: "Include if it compares rivals." },
      { id: "cl5", text: "Include if recent." },
    ],
  },
];

const allIds = criteria.flatMap((rule) =>
  rule.criteria.map((criterion) => criterion.id),
);

/** Marks the given ids matched; every other configured id is left unmatched. */
const evaluate = (matchedIds: string[]): CriterionEvaluation[] =>
  allIds.map((id) => ({
    id,
    matched: matchedIds.includes(id),
    note: matchedIds.includes(id) ? "evidence present" : "absent",
  }));

describe("buildSectionClassificationMessages", () => {
  it("includes the grouped rules, labels, title, and content", () => {
    const messages = buildSectionClassificationMessages({
      title: "Acme buys Globex",
      content: "Acme announced an acquisition.",
      acceptanceCriteria: criteria,
    });
    const system = messages[0]!;
    const user = messages[1]!;

    expect(system.role).toBe("system");
    expect(String(user.content)).toContain(
      "competitiveLandscape (Competitive Landscape):",
    );
    expect(String(user.content)).toContain(
      "  - cl1: Include if a peer is named.",
    );
    expect(String(user.content)).toContain("Acme buys Globex");
    expect(String(user.content)).toContain("Acme announced an acquisition.");
  });

  it("substitutes ticker placeholders in the rendered rules", () => {
    const messages = buildSectionClassificationMessages({
      title: "Coffee bean prices climb",
      content: "Arabica futures rose.",
      acceptanceCriteria: [
        {
          section: "industryPulse",
          criteria: [
            {
              id: "ip-x",
              text: "Include if it moves {{INDUSTRY}} for {{TICKER}}.",
            },
          ],
        },
      ],
      ticker: {
        symbol: "FORE",
        name: "PT Fore Kopi Indonesia Tbk",
        sector: "Barang Konsumen Primer",
        industry: "Minuman",
        subIndustry: "Minuman Ringan",
        businessActivity: "Bisnis Kedai Kopi",
      },
    });
    const user = messages[1]!;

    expect(String(user.content)).toContain(
      "  - ip-x: Include if it moves Minuman for FORE.",
    );
    expect(String(user.content)).not.toContain("{{INDUSTRY}}");
  });

  it("falls back to generic phrasing when no ticker is provided", () => {
    const messages = buildSectionClassificationMessages({
      title: "Coffee bean prices climb",
      content: "Arabica futures rose.",
      acceptanceCriteria: [
        {
          section: "industryPulse",
          criteria: [
            {
              id: "ip-x",
              text: "Include if it moves {{INDUSTRY}} for {{TICKER}}.",
            },
          ],
        },
      ],
    });
    const user = messages[1]!;

    expect(String(user.content)).toContain(
      "  - ip-x: Include if it moves the issuer's industry for the issuer.",
    );
  });

  it("includes the issuer context line when tickerContext is provided", () => {
    const messages = buildSectionClassificationMessages({
      title: "Rival bank cuts rates",
      content: "A competitor lowered rates.",
      acceptanceCriteria: criteria,
      tickerContext: "Issuer context: collected for AGRO.",
    });
    const user = messages[1]!;

    expect(String(user.content)).toContain(
      "Issuer context: collected for AGRO.",
    );
  });

  it("includes the mandatory issuer-relevance gate only when tickerContext is provided", () => {
    const withContext = buildSectionClassificationMessages({
      title: "Rival bank cuts rates",
      content: "A competitor lowered rates.",
      acceptanceCriteria: criteria,
      tickerContext: "Issuer context: collected for AGRO.",
    });
    const withoutContext = buildSectionClassificationMessages({
      title: "Rival bank cuts rates",
      content: "A competitor lowered rates.",
      acceptanceCriteria: criteria,
    });

    expect(String(withContext[1]!.content)).toContain(
      ISSUER_RELEVANCE_CRITERION_ID,
    );
    expect(String(withoutContext[1]!.content)).not.toContain(
      ISSUER_RELEVANCE_CRITERION_ID,
    );
  });

  it("appends the product_contract block to the system prompt when a brief is present", () => {
    const withBrief = buildSectionClassificationMessages({
      title: "Acme buys Globex",
      content: "Acme announced an acquisition.",
      acceptanceCriteria: criteria,
      brief: "Focus on Indonesian banking sector dynamics.",
    });
    const withoutBrief = buildSectionClassificationMessages({
      title: "Acme buys Globex",
      content: "Acme announced an acquisition.",
      acceptanceCriteria: criteria,
    });

    expect(String(withBrief[0]!.content)).toContain("<product_contract>");
    expect(String(withBrief[0]!.content)).toContain(
      "Focus on Indonesian banking sector dynamics.",
    );
    expect(String(withoutBrief[0]!.content)).not.toContain("product_contract");
  });

  it("truncates long content to MAX_CONTENT_CHARS", () => {
    const longContent = "x".repeat(MAX_CONTENT_CHARS + 500);
    const messages = buildSectionClassificationMessages({
      title: "t",
      content: longContent,
      acceptanceCriteria: criteria,
    });
    const user = messages[1]!;

    expect(String(user.content)).not.toContain(
      "x".repeat(MAX_CONTENT_CHARS + 1),
    );
  });
});

describe("renderArticleTickerContext", () => {
  it("renders the issuer and its business descriptors", () => {
    const line = renderArticleTickerContext({
      symbol: "AGRO",
      name: "PT Bank Raya Indonesia Tbk",
      sector: "Keuangan",
      industry: "Bank",
      subIndustry: "Bank",
      businessActivity: "Perbankan",
    });

    expect(line).toContain("AGRO (PT Bank Raya Indonesia Tbk)");
    expect(line).toContain("main business Perbankan");
  });

  it("returns null for ticker-agnostic rows", () => {
    expect(renderArticleTickerContext(null)).toBeNull();
  });
});

describe("buildEvaluationSchema", () => {
  it("accepts judgments referencing configured ids", () => {
    const schema = buildEvaluationSchema(allIds);
    const parsed = schema.parse({
      evaluations: [{ id: "ip1", matched: true, note: "macro move" }],
    });

    expect(parsed.evaluations[0]!.id).toBe("ip1");
  });

  it("rejects judgments referencing an unknown id", () => {
    const schema = buildEvaluationSchema(allIds);

    expect(() =>
      schema.parse({
        evaluations: [{ id: "unknown", matched: true, note: "x" }],
      }),
    ).toThrow();
  });
});

describe("scoreFromEvaluations", () => {
  it("scores one match of five as 0.2", () => {
    const result = scoreFromEvaluations(evaluate(["ip1"]), criteria);

    expect(result.section).toBe("industryPulse");
    expect(result.score).toBeCloseTo(0.2);
  });

  it("scores three matches of five as 0.6", () => {
    const result = scoreFromEvaluations(
      evaluate(["ip1", "ip3", "ip4"]),
      criteria,
    );

    expect(result.section).toBe("industryPulse");
    expect(result.score).toBeCloseTo(0.6);
  });

  it("scores all five matches as 1", () => {
    const result = scoreFromEvaluations(
      evaluate(["ip1", "ip2", "ip3", "ip4", "ip5"]),
      criteria,
    );

    expect(result.score).toBe(1);
  });

  it("assigns the section with the highest matched fraction (argmax)", () => {
    const result = scoreFromEvaluations(
      evaluate(["ip1", "cl1", "cl2", "cl3"]),
      criteria,
    );

    expect(result.section).toBe("competitiveLandscape");
    expect(result.score).toBeCloseTo(0.6);
  });

  it("breaks ties by canonical display order", () => {
    const result = scoreFromEvaluations(
      evaluate(["ip1", "ip2", "cl1", "cl2"]),
      criteria,
    );

    expect(result.section).toBe("industryPulse");
    expect(result.score).toBeCloseTo(0.4);
  });

  it("rejects when no rule matches in any section", () => {
    const result = scoreFromEvaluations(evaluate([]), criteria);

    expect(result.section).toBeNull();
    expect(result.score).toBe(0);
    expect(result.reason).toContain("No inclusion rule matched");
    expect(result.scoreBreakdown.criteria).toHaveLength(10);
    expect(
      result.scoreBreakdown.criteria.every((criterion) => !criterion.matched),
    ).toBe(true);
    expect(result.scoreBreakdown.sections).toHaveLength(2);
  });

  it("treats omitted judgments as not matched without throwing", () => {
    const partial: CriterionEvaluation[] = [
      { id: "ip1", matched: true, note: "macro" },
    ];
    const result = scoreFromEvaluations(partial, criteria);

    expect(result.section).toBe("industryPulse");
    expect(result.score).toBeCloseTo(0.2);
  });

  it("names matched and missed rules in the reason", () => {
    const result = scoreFromEvaluations(evaluate(["ip1", "ip3"]), criteria);

    expect(result.reason).toContain("Industry Pulse — matched 2/5");
    expect(result.reason).toContain("ip1");
    expect(result.reason).toContain("Missed:");
    expect(result.reason).toContain("ip2");
  });

  it("builds a self-describing breakdown for the winning section", () => {
    const result = scoreFromEvaluations(evaluate(["ip1"]), criteria);

    expect(result.scoreBreakdown.section).toBe("industryPulse");
    expect(result.scoreBreakdown.matched).toBe(1);
    expect(result.scoreBreakdown.total).toBe(5);
    expect(result.scoreBreakdown.criteria[0]).toMatchObject({
      id: "ip1",
      section: "industryPulse",
      text: "Include if macro.",
      matched: true,
    });
    expect(result.scoreBreakdown.criteriaHash).toBe(criteriaHash(criteria));
  });

  it("keeps every section's per-rule judgments, not just the winner's", () => {
    const result = scoreFromEvaluations(evaluate(["ip1", "cl2"]), criteria);
    const bySection = new Map(
      result.scoreBreakdown.criteria.map((criterion) => [
        criterion.id,
        criterion,
      ]),
    );

    expect(result.section).toBe("industryPulse");
    expect(result.scoreBreakdown.criteria).toHaveLength(10);
    expect(bySection.get("cl2")).toMatchObject({
      section: "competitiveLandscape",
      text: "Include if positioning shifts.",
      matched: true,
      note: "evidence present",
    });
    expect(bySection.get("cl1")).toMatchObject({
      section: "competitiveLandscape",
      matched: false,
      note: "absent",
    });
  });

  it("scopes the composed reason to the winning section only", () => {
    const result = scoreFromEvaluations(evaluate(["ip1", "cl2"]), criteria);

    expect(result.reason).toContain("Industry Pulse — matched 1/5");
    expect(result.reason).not.toContain("cl1");
    expect(result.reason).not.toContain("cl2");
  });
});

describe("scoreFromEvaluations — issuer-relevance gate", () => {
  it("rejects when the gate is not matched, even though other criteria matched (quickHits-style false win)", () => {
    const evaluations: CriterionEvaluation[] = [
      ...evaluate(["ip1", "ip3"]),
      {
        id: ISSUER_RELEVANCE_CRITERION_ID,
        matched: false,
        note: "unrelated topic",
      },
    ];

    const result = scoreFromEvaluations(evaluations, criteria, true);

    expect(result.section).toBeNull();
    expect(result.score).toBe(0);
    expect(result.reason).toContain("not relevant to issuer context");
    expect(result.reason).toContain("unrelated topic");
  });

  it("proceeds with normal argmax scoring when the gate is matched", () => {
    const evaluations: CriterionEvaluation[] = [
      ...evaluate(["ip1", "ip3", "ip4"]),
      {
        id: ISSUER_RELEVANCE_CRITERION_ID,
        matched: true,
        note: "about the issuer",
      },
    ];

    const result = scoreFromEvaluations(evaluations, criteria, true);

    expect(result.section).toBe("industryPulse");
    expect(result.score).toBeCloseTo(0.6);
  });

  it("fails closed when the gate judgment is omitted entirely", () => {
    const result = scoreFromEvaluations(
      evaluate(["ip1", "ip3"]),
      criteria,
      true,
    );

    expect(result.section).toBeNull();
    expect(result.reason).toContain("not relevant to issuer context");
  });

  it("is a no-op when requireIssuerRelevance is false, even if a gate id happens to be present", () => {
    const evaluations: CriterionEvaluation[] = [
      ...evaluate(["ip1", "ip3", "ip4"]),
      {
        id: ISSUER_RELEVANCE_CRITERION_ID,
        matched: false,
        note: "unrelated",
      },
    ];

    const result = scoreFromEvaluations(evaluations, criteria);

    expect(result.section).toBe("industryPulse");
    expect(result.score).toBeCloseTo(0.6);
  });
});

describe("rejectEmptySource", () => {
  it("rejects with an empty breakdown and the current criteria hash", () => {
    const result = rejectEmptySource(criteria);

    expect(result.section).toBeNull();
    expect(result.score).toBe(0);
    expect(result.reason).toContain("no description or content");
    expect(result.scoreBreakdown.criteria).toEqual([]);
    expect(result.scoreBreakdown.sections).toEqual([]);
    expect(result.scoreBreakdown.criteriaHash).toBe(criteriaHash(criteria));
  });
});

/** A single section carrying its real issuer-relevance rule id (`rp-sector-impact`). */
const issuerCapCriteria: AcceptanceCriteriaRule[] = [
  {
    section: "regulatoryPolicyWatch",
    criteria: [
      { id: "rp-regulatory-topic", text: "Include if regulatory." },
      { id: "rp-authority-named", text: "Include if an authority is named." },
      { id: "rp-sector-impact", text: "Include if it affects the issuer." },
      { id: "rp-actionable-change", text: "Include if it is a change." },
      { id: "rp-cited-source", text: "Include if cited." },
    ],
  },
];

const issuerCapIds = issuerCapCriteria.flatMap((rule) =>
  rule.criteria.map((criterion) => criterion.id),
);

const evaluateIssuerCap = (matchedIds: string[]): CriterionEvaluation[] =>
  issuerCapIds.map((id) => ({
    id,
    matched: matchedIds.includes(id),
    note: matchedIds.includes(id) ? "evidence present" : "absent",
  }));

describe("scoreFromEvaluations issuer-relevance cap", () => {
  it("caps the fit score when the winning section's issuer-relevance rule is unmatched", () => {
    const result = scoreFromEvaluations(
      evaluateIssuerCap([
        "rp-regulatory-topic",
        "rp-authority-named",
        "rp-actionable-change",
      ]),
      issuerCapCriteria,
    );

    expect(result.section).toBe("regulatoryPolicyWatch");
    expect(result.score).toBe(0.4);
    expect(result.scoreBreakdown.matched).toBe(3);
    expect(result.reason).toContain("rp-sector-impact unmatched");
  });

  it("keeps the full score when the issuer-relevance rule is matched", () => {
    const result = scoreFromEvaluations(
      evaluateIssuerCap([
        "rp-regulatory-topic",
        "rp-authority-named",
        "rp-sector-impact",
        "rp-actionable-change",
      ]),
      issuerCapCriteria,
    );

    expect(result.section).toBe("regulatoryPolicyWatch");
    expect(result.score).toBe(0.8);
    expect(result.reason).not.toContain("capped");
  });

  it("does not raise a score already below the cap", () => {
    const result = scoreFromEvaluations(
      evaluateIssuerCap(["rp-regulatory-topic"]),
      issuerCapCriteria,
    );

    expect(result.score).toBe(0.2);
  });

  it("does not cap a section whose rules carry no issuer-relevance id", () => {
    const result = scoreFromEvaluations(
      evaluate(["cl1", "cl2", "cl3"]),
      criteria,
    );

    expect(result.section).toBe("competitiveLandscape");
    expect(result.score).toBeCloseTo(0.6);
    expect(result.reason).not.toContain("capped");
  });
});

describe("criteriaHash", () => {
  it("is stable for the same criteria and changes when text changes", () => {
    const edited: AcceptanceCriteriaRule[] = [
      {
        section: "industryPulse",
        criteria: [{ id: "ip1", text: "Include if macro (edited)." }],
      },
    ];

    expect(criteriaHash(criteria)).toBe(criteriaHash(criteria));
    expect(criteriaHash(criteria)).not.toBe(criteriaHash(edited));
  });
});
