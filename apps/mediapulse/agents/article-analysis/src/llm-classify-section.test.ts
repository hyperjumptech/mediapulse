import { describe, expect, it } from "vitest";

import type { AcceptanceCriteriaRule } from "./config-schema.js";
import {
  articleAnalysisConfigSchema,
  flattenAcceptanceCriteria,
} from "./config-schema.js";
import {
  buildEvaluationSchema,
  buildSectionClassificationMessages,
  criteriaHash,
  ISSUER_RELEVANCE_CRITERION_ID,
  ISSUER_RELEVANCE_RULE_IDS,
  MARKET_ANCHOR_RULE_IDS,
  SECTION_DEFINING_RULE_IDS,
  MAX_CONTENT_CHARS,
  rejectEmptySource,
  renderArticleTickerContext,
  scoreFromEvaluations,
  sectionsClosedToSource,
  type CriterionEvaluation,
} from "./llm-classify-section.js";

/** Two sections, five rules each, in canonical display order (industryPulse before competitive). */
const criteria: AcceptanceCriteriaRule[] = [
  {
    section: "industryPulse",
    criteria: [
      { id: "ip1", text: "Include if macro.", qualifying: false },
      { id: "ip2", text: "Include if multi-issuer.", qualifying: false },
      { id: "ip3", text: "Include if significant.", qualifying: false },
      { id: "ip4", text: "Include if forward-looking.", qualifying: false },
      { id: "ip5", text: "Include if cited.", qualifying: false },
    ],
  },
  {
    section: "competitiveLandscape",
    criteria: [
      { id: "cl1", text: "Include if a peer is named.", qualifying: false },
      { id: "cl2", text: "Include if positioning shifts.", qualifying: false },
      { id: "cl3", text: "Include if issuer-relevant.", qualifying: false },
      { id: "cl4", text: "Include if it compares rivals.", qualifying: false },
      { id: "cl5", text: "Include if recent.", qualifying: false },
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
              qualifying: false,
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
        aliases: [],
        competitors: [],
        regulators: [],
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
              qualifying: false,
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

  it("tells the gate to exclude another country's market", () => {
    const messages = buildSectionClassificationMessages({
      title: "Vietnam raises treasury deposit allowance",
      content: "Commercial banks may count half of State Treasury deposits.",
      acceptanceCriteria: criteria,
      tickerContext: "Issuer context: collected for BMRI.",
    });
    const user = String(messages[1]!.content);
    const system = String(messages[0]!.content);

    expect(user).toContain("Exclude too when the article is about another");
    expect(user).toContain(
      "A same-industry company abroad is a coincidental match",
    );
    expect(user).toContain("World prices for a commodity the issuer produces");
    expect(system).toContain("another country's market with no stated tie");
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

describe("ISSUER_RELEVANCE_RULE_IDS", () => {
  it("references only ids that exist in the seeded criteria", () => {
    const config = articleAnalysisConfigSchema.parse({});
    const seededIds = new Set(
      flattenAcceptanceCriteria(config.acceptanceCriteria).map(
        (criterion) => criterion.id,
      ),
    );

    for (const ruleId of ISSUER_RELEVANCE_RULE_IDS) {
      expect(seededIds.has(ruleId)).toBe(true);
    }
  });

  it("covers every capped section exactly once, and never competitiveLandscape", () => {
    const config = articleAnalysisConfigSchema.parse({});
    const coveredSections = flattenAcceptanceCriteria(config.acceptanceCriteria)
      .filter((criterion) => ISSUER_RELEVANCE_RULE_IDS.has(criterion.id))
      .map((criterion) => criterion.section);

    expect(coveredSections).toEqual([
      "dealsAndMovements",
      "disruptorsOrTech",
      "quickHits",
    ]);
  });

  it("leaves competitiveLandscape uncapped because its own gate corroborates it", () => {
    const config = articleAnalysisConfigSchema.parse({});
    const qualifyingIds = flattenAcceptanceCriteria(config.acceptanceCriteria)
      .filter(
        (criterion) =>
          criterion.section === "competitiveLandscape" && criterion.qualifying,
      )
      .map((criterion) => criterion.id);

    expect(ISSUER_RELEVANCE_RULE_IDS.has("cl-issuer-side")).toBe(false);
    expect(qualifyingIds).toEqual([
      "cl-peer-named",
      "cl-peer-action",
      "cl-market-overlap",
    ]);
  });
});

describe("MARKET_ANCHOR_RULE_IDS", () => {
  it("references only ids that exist in the seeded criteria", () => {
    const config = articleAnalysisConfigSchema.parse({});
    const seededIds = new Set(
      flattenAcceptanceCriteria(config.acceptanceCriteria).map(
        (criterion) => criterion.id,
      ),
    );

    for (const ruleId of MARKET_ANCHOR_RULE_IDS) {
      expect(seededIds.has(ruleId)).toBe(true);
    }
  });

  it("excludes cl-issuer-side, which measures closeness rather than market membership", () => {
    expect(MARKET_ANCHOR_RULE_IDS.has("cl-issuer-side")).toBe(false);
  });

  it("includes rp-market-scope, the only anchor a company-free policy story can match", () => {
    expect(MARKET_ANCHOR_RULE_IDS.has("rp-market-scope")).toBe(true);
  });

  it("gives every seeded section an anchor, so no section is unreachable through the override", () => {
    const config = articleAnalysisConfigSchema.parse({});
    const criteria = flattenAcceptanceCriteria(config.acceptanceCriteria);
    const anchoredSections = new Set(
      criteria
        .filter((criterion) => MARKET_ANCHOR_RULE_IDS.has(criterion.id))
        .map((criterion) => criterion.section),
    );

    for (const section of new Set(criteria.map((c) => c.section))) {
      expect(
        anchoredSections.has(section),
        `section '${section}' has no MARKET_ANCHOR_RULE_IDS entry`,
      ).toBe(true);
    }
  });
});

describe("SECTION_DEFINING_RULE_IDS", () => {
  it("names exactly one qualifying rule in every seeded section", () => {
    const config = articleAnalysisConfigSchema.parse({});
    const criteria = flattenAcceptanceCriteria(config.acceptanceCriteria);
    const bySection = new Map<string, string[]>();
    for (const criterion of criteria) {
      if (!SECTION_DEFINING_RULE_IDS.has(criterion.id)) {
        continue;
      }
      bySection.set(criterion.section, [
        ...(bySection.get(criterion.section) ?? []),
        criterion.id,
      ]);

      expect(
        criterion.qualifying,
        `defining rule '${criterion.id}' must be qualifying`,
      ).toBe(true);
    }

    for (const section of new Set(criteria.map((c) => c.section))) {
      expect(
        bySection.get(section)?.length,
        `section '${section}' must name exactly one defining rule`,
      ).toBe(1);
    }
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
      aliases: [],
      competitors: [],
      regulators: [],
    });

    expect(line).toContain("AGRO (PT Bank Raya Indonesia Tbk)");
    expect(line).toContain("main business Perbankan");
  });

  it("states the issuer's home market so foreign coverage is judged against it", () => {
    const line = renderArticleTickerContext({
      symbol: "BMRI",
      name: "PT Bank Mandiri (Persero) Tbk",
      sector: "Keuangan",
      industry: "Bank",
      subIndustry: "Bank",
      businessActivity: "Perbankan",
      aliases: [],
      competitors: [],
      regulators: [],
    });

    expect(line).toContain("home market is Indonesia");
    expect(line).toContain("Indonesia Stock Exchange");
  });

  it("names the issuer's own brands so they are not read as competitors", () => {
    const line = renderArticleTickerContext({
      symbol: "TLKM",
      name: "PT Telkom Indonesia (Persero) Tbk",
      sector: "Infrastruktur",
      industry: "Jasa Telekomunikasi",
      subIndustry: "Jasa Telekomunikasi Terintegrasi",
      businessActivity: "Penyelenggara Jaringan dan Jasa Telekom",
      aliases: ["Telkomsel", "IndiHome"],
      competitors: [],
      regulators: [],
    });

    expect(line).toContain("Telkomsel, IndiHome");
    expect(line).toContain("not about a competitor");
  });

  it("says the brand list is not exhaustive so a group company is still the issuer", () => {
    const line = renderArticleTickerContext({
      symbol: "TLKM",
      name: "PT Telkom Indonesia (Persero) Tbk",
      sector: "Infrastruktur",
      industry: "Jasa Telekomunikasi",
      subIndustry: "Jasa Telekomunikasi Terintegrasi",
      businessActivity: "Penyelenggara Jaringan dan Jasa Telekom",
      aliases: ["Telkomsel"],
      competitors: [],
      regulators: [],
    });

    expect(line).toContain(
      "subsidiary, parent, or other company in the same corporate group",
    );
    expect(line).toContain(
      "listed separately on the exchange under its own symbol",
    );
  });

  it("renders known competitors with the spellings they appear under", () => {
    const line = renderArticleTickerContext({
      symbol: "TLKM",
      name: "PT Telkom Indonesia (Persero) Tbk",
      sector: "Infrastruktur",
      industry: "Jasa Telekomunikasi",
      subIndustry: "Jasa Telekomunikasi Terintegrasi",
      businessActivity: "Penyelenggara Jaringan dan Jasa Telekom",
      aliases: [],
      competitors: [
        { name: "Indosat", aliases: ["ISAT"] },
        { name: "XLSMART Telecom Sejahtera", aliases: ["EXCL", "XLSmart"] },
        { name: "Starlink", aliases: [] },
      ],
      regulators: [],
    });

    expect(line).toContain("Indosat (ISAT)");
    expect(line).toContain("XLSMART Telecom Sejahtera (EXCL, XLSmart)");
    expect(line).toContain("Starlink");
  });

  it("omits the brand and peer lines when the profile carries neither", () => {
    const line = renderArticleTickerContext({
      symbol: "AGRO",
      name: "PT Bank Raya Indonesia Tbk",
      sector: null,
      industry: null,
      subIndustry: null,
      businessActivity: null,
      aliases: [],
      competitors: [],
      regulators: [],
    });

    expect(line).not.toContain("also trades under");
    expect(line).not.toContain("Known competitors");
    expect(line).not.toContain("Government bodies");
  });

  it("renders the issuer's regulators with the spellings they appear under", () => {
    const line = renderArticleTickerContext({
      symbol: "DSSA",
      name: "Dian Swastatika Sentosa Tbk",
      sector: "Energy",
      industry: "Coal, Power and Telecom Holdings",
      subIndustry: "Coal and Power with Data Centres and Telecom",
      businessActivity: "Coal mining and independent power plants",
      aliases: [],
      competitors: [],
      regulators: [
        {
          name: "Ministry of Energy and Mineral Resources",
          aliases: ["ESDM", "Kementerian ESDM"],
        },
        { name: "Indonesia Stock Exchange", aliases: [] },
      ],
    });

    expect(line).toContain(
      "Ministry of Energy and Mineral Resources (ESDM, Kementerian ESDM)",
    );
    expect(line).toContain("Indonesia Stock Exchange");
    expect(line).toContain(
      "even when the article never names the issuer or a competitor",
    );
  });

  it("returns null for ticker-agnostic rows", () => {
    expect(renderArticleTickerContext(null)).toBeNull();
  });
});

describe("issuer-title fallback and section-defining rules", () => {
  const realCriteria = () =>
    articleAnalysisConfigSchema.parse({}).acceptanceCriteria;

  const judge = (matchedIds: readonly string[]): CriterionEvaluation[] => {
    const matched = new Set(matchedIds);

    return flattenAcceptanceCriteria(realCriteria()).map((criterion) => ({
      id: criterion.id,
      matched: matched.has(criterion.id),
      note: matched.has(criterion.id) ? "evidence present" : "absent",
    }));
  };

  it("refuses issuerPerformance for a headline naming the issuer that reports no result", () => {
    const result = scoreFromEvaluations(
      judge(["pf-issuer-subject", "pf-period-stated"]),
      realCriteria(),
      false,
      true,
    );

    expect(result.section).toBeNull();
  });

  it("still admits an issuer result that clears no gate but reports a figure", () => {
    const result = scoreFromEvaluations(
      judge(["pf-reported-result", "pf-period-stated", "pf-direction-given"]),
      realCriteria(),
      false,
      true,
    );

    expect(result.section).toBe("issuerPerformance");
  });

  it("refuses dealsAndMovements for named parties with no corporate action", () => {
    const result = scoreFromEvaluations(
      judge(["dm-parties-named", "dm-terms-stated", "dm-confirmed"]),
      realCriteria(),
      false,
      true,
    );

    expect(result.section).not.toBe("dealsAndMovements");
  });

  it("leaves a config whose rules carry none of the defining ids unrestricted", () => {
    const custom: AcceptanceCriteriaRule[] = [
      {
        section: "issuerPerformance",
        criteria: [
          { id: "x1", text: "Include if issuer.", qualifying: true },
          { id: "x2", text: "Include if result.", qualifying: true },
          { id: "x3", text: "Include if period.", qualifying: false },
          { id: "x4", text: "Include if direction.", qualifying: false },
        ],
      },
    ];
    const result = scoreFromEvaluations(
      [
        { id: "x1", matched: true, note: "y" },
        { id: "x2", matched: false, note: "n" },
        { id: "x3", matched: true, note: "y" },
        { id: "x4", matched: false, note: "n" },
      ],
      custom,
      false,
      true,
    );

    expect(result.section).toBe("issuerPerformance");
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

  it("breaks ties toward the more specific section, not display order", () => {
    const result = scoreFromEvaluations(
      evaluate(["ip1", "ip2", "cl1", "cl2"]),
      criteria,
    );

    expect(result.section).toBe("competitiveLandscape");
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

    expect(result.section).toBe("competitiveLandscape");
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

    expect(result.reason).toContain("Competitive Landscape — matched 1/5");
    expect(result.reason).not.toContain("ip1");
    expect(result.reason).not.toContain("ip2");
  });
});

describe("scoreFromEvaluations — qualifying gates and precedence", () => {
  /** industryPulse is gated on ip1+ip2; competitiveLandscape on cl1+cl2. */
  const gated: AcceptanceCriteriaRule[] = [
    {
      section: "industryPulse",
      criteria: [
        { id: "ip1", text: "Include if macro.", qualifying: true },
        { id: "ip2", text: "Include if market named.", qualifying: true },
        { id: "ip3", text: "Include if driver named.", qualifying: false },
        { id: "ip4", text: "Include if forward-looking.", qualifying: false },
        { id: "ip5", text: "Include if multi-issuer.", qualifying: false },
      ],
    },
    {
      section: "competitiveLandscape",
      criteria: [
        { id: "cl1", text: "Include if a peer is named.", qualifying: true },
        { id: "cl2", text: "Include if the peer acted.", qualifying: true },
        { id: "cl3", text: "Include if markets overlap.", qualifying: false },
      ],
    },
  ];

  const evaluateGated = (matchedIds: string[]): CriterionEvaluation[] =>
    gated
      .flatMap((rule) => rule.criteria.map((criterion) => criterion.id))
      .map((id) => ({
        id,
        matched: matchedIds.includes(id),
        note: matchedIds.includes(id) ? "evidence present" : "absent",
      }));

  it("prefers the qualifying section over a higher-scoring unqualified one", () => {
    const result = scoreFromEvaluations(
      evaluateGated(["ip1", "ip3", "ip4", "ip5", "cl1", "cl2"]),
      gated,
    );

    expect(result.section).toBe("competitiveLandscape");
    expect(result.scoreBreakdown.matched).toBe(2);
  });

  it("prefers the more specific section when both qualify", () => {
    const result = scoreFromEvaluations(
      evaluateGated(["ip1", "ip2", "cl1", "cl2"]),
      gated,
    );

    expect(result.section).toBe("competitiveLandscape");
    expect(result.reason).toContain("most specific qualifying section");
    expect(result.reason).toContain("industryPulse");
  });

  it("falls back to the catch-all when the specific gate fails", () => {
    const result = scoreFromEvaluations(
      evaluateGated(["ip1", "ip2", "cl1", "cl3"]),
      gated,
    );

    expect(result.section).toBe("industryPulse");
  });

  it("records each section's gate outcome in the breakdown", () => {
    const result = scoreFromEvaluations(
      evaluateGated(["ip1", "ip2", "cl1"]),
      gated,
    );
    const byId = new Map(
      result.scoreBreakdown.sections.map((section) => [
        section.section,
        section,
      ]),
    );

    expect(byId.get("industryPulse")?.qualified).toBe(true);
    expect(byId.get("competitiveLandscape")?.qualified).toBe(false);
  });

  it("falls back to matched fraction when no section defines a gate", () => {
    const result = scoreFromEvaluations(
      evaluate(["ip1", "cl1", "cl2", "cl3"]),
      criteria,
    );

    expect(result.section).toBe("competitiveLandscape");
    expect(result.reason).toContain("chosen on matched fraction");
  });

  it("names a response carrying no rule judgments as such, not as a verdict", () => {
    const result = scoreFromEvaluations([], criteria);

    expect(result.section).toBeNull();
    expect(result.reason).toBe(
      "Model returned no rule judgments; rejected without a verdict.",
    );
  });

  it("still reports a real verdict when the model judged the rules and none matched", () => {
    const result = scoreFromEvaluations(evaluate([]), criteria);

    expect(result.section).toBeNull();
    expect(result.reason).not.toContain("no rule judgments");
  });

  it("rejects an article that clears no gate even when single rules matched", () => {
    const result = scoreFromEvaluations(evaluateGated(["ip3", "cl3"]), gated);

    expect(result.section).toBeNull();
    expect(result.score).toBe(0);
    expect(result.reason).toBe(
      "No section met its qualifying rules; rejected.",
    );
  });

  it("keeps an article that clears no gate when its headline names the issuer", () => {
    const rejected = scoreFromEvaluations(
      evaluateGated(["ip1", "ip3", "ip4"]),
      gated,
      false,
      false,
    );
    const kept = scoreFromEvaluations(
      evaluateGated(["ip1", "ip3", "ip4"]),
      gated,
      false,
      true,
    );

    expect(rejected.section).toBeNull();
    expect(kept.section).toBe("industryPulse");
  });

  it("rejects an issuer-named article matching too few of a section's rules", () => {
    const result = scoreFromEvaluations(
      evaluateGated(["ip3", "cl3"]),
      gated,
      false,
      true,
    );

    expect(result.section).toBeNull();
    expect(result.reason).toContain("No section met its qualifying rules");
  });

  it("still rejects an issuer-named article when no rule matched anywhere", () => {
    const result = scoreFromEvaluations(evaluateGated([]), gated, false, true);

    expect(result.section).toBeNull();
    expect(result.score).toBe(0);
  });

  it("rejects when only one of a section's two gate rules matched", () => {
    const result = scoreFromEvaluations(
      evaluateGated(["ip1", "ip3", "ip4", "ip5"]),
      gated,
    );

    expect(result.section).toBeNull();
    expect(result.reason).toContain("No section met its qualifying rules");
  });

  it("still records every section's tally when the article is rejected", () => {
    const result = scoreFromEvaluations(evaluateGated(["ip3"]), gated);
    const byId = new Map(
      result.scoreBreakdown.sections.map((section) => [
        section.section,
        section,
      ]),
    );

    expect(byId.get("industryPulse")?.matched).toBe(1);
    expect(byId.get("industryPulse")?.qualified).toBe(false);
    expect(byId.get("competitiveLandscape")?.qualified).toBe(false);
  });
});

describe("scoreFromEvaluations — issuer-relevance gate", () => {
  it("does not reject on a failed gate when the headline names the issuer", () => {
    const evaluations: CriterionEvaluation[] = [
      ...evaluate(["ip1", "ip3"]),
      {
        id: ISSUER_RELEVANCE_CRITERION_ID,
        matched: false,
        note: "does not mention the issuer",
      },
    ];

    const result = scoreFromEvaluations(evaluations, criteria, true, true);

    expect(result.section).not.toBeNull();
    expect(result.scoreBreakdown.issuerRelevance?.overridden).toBe(true);
  });

  it("does not reject on a failed gate when the article names a listed regulator", () => {
    const evaluations: CriterionEvaluation[] = [
      ...evaluate(["ip1", "ip3"]),
      {
        id: ISSUER_RELEVANCE_CRITERION_ID,
        matched: false,
        note: "does not concern FORE or any of its competitors",
      },
    ];

    const result = scoreFromEvaluations(
      evaluations,
      criteria,
      true,
      false,
      false,
      new Set(),
      null,
      {
        kind: "regulator",
        name: "National Agency of Drug and Food Control",
      },
    );

    expect(result.section).not.toBeNull();
    expect(result.scoreBreakdown.issuerRelevance?.overridden).toBe(true);
    expect(result.scoreBreakdown.issuerRelevance?.marketParty).toStrictEqual({
      kind: "regulator",
      name: "National Agency of Drug and Food Control",
    });
  });

  it("caps the fit score when relevance rests only on a regulator", () => {
    const evaluations: CriterionEvaluation[] = [
      ...evaluate(["ip1", "ip2", "ip3", "ip4", "ip5"]),
      {
        id: ISSUER_RELEVANCE_CRITERION_ID,
        matched: false,
        note: "does not concern the issuer",
      },
    ];

    const result = scoreFromEvaluations(
      evaluations,
      criteria,
      true,
      false,
      false,
      new Set(),
      null,
      {
        kind: "regulator",
        name: "National Agency of Drug and Food Control",
      },
    );

    expect(result.section).not.toBeNull();
    expect(result.score).toBeLessThanOrEqual(0.4);
    expect(result.reason).toContain("rests only on the regulator");
  });

  it("does not cap the fit score when a competitor carries the relevance", () => {
    const evaluations: CriterionEvaluation[] = [
      ...evaluate(["ip1", "ip2", "ip3", "ip4", "ip5"]),
      {
        id: ISSUER_RELEVANCE_CRITERION_ID,
        matched: false,
        note: "does not mention the issuer",
      },
    ];

    const result = scoreFromEvaluations(
      evaluations,
      criteria,
      true,
      false,
      false,
      new Set(),
      null,
      { kind: "competitor", name: "Tomoro Coffee" },
    );

    expect(result.score).toBeGreaterThan(0.4);
    expect(result.reason).not.toContain("rests only on the regulator");
  });

  it("does not reject on a failed gate when the article names a listed competitor", () => {
    const evaluations: CriterionEvaluation[] = [
      ...evaluate(["ip1", "ip3"]),
      {
        id: ISSUER_RELEVANCE_CRITERION_ID,
        matched: false,
        note: "the article is about Telkom's subsidiary Telin, not a direct competitor",
      },
    ];

    const result = scoreFromEvaluations(
      evaluations,
      criteria,
      true,
      false,
      false,
      new Set(),
      null,
      { kind: "competitor", name: "Telkom Indonesia (Persero)" },
    );

    expect(result.section).not.toBeNull();
    expect(result.scoreBreakdown.issuerRelevance?.overridden).toBe(true);
  });

  it("still rejects a failed gate when the article names no listed party", () => {
    const evaluations: CriterionEvaluation[] = [
      ...evaluate(["ip1", "ip3"]),
      {
        id: ISSUER_RELEVANCE_CRITERION_ID,
        matched: false,
        note: "unrelated topic",
      },
    ];

    const result = scoreFromEvaluations(
      evaluations,
      criteria,
      true,
      false,
      false,
      new Set(),
      null,
      null,
    );

    expect(result.section).toBeNull();
    expect(result.reason).toContain("not relevant to issuer context");
  });

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
    expect(result.reason).toContain("no issuer-relevance verdict");
  });

  it("does not report an omitted gate judgment as a relevance decision", () => {
    const result = scoreFromEvaluations(
      evaluate(["ip1", "ip3"]),
      criteria,
      true,
    );

    expect(result.reason).not.toContain("not relevant to issuer context");
    expect(result.reason).not.toContain("No judgment returned");
  });

  it("still reports a judged-false gate as a relevance decision", () => {
    const evaluations: CriterionEvaluation[] = [
      ...evaluate(["ip1", "ip3"]),
      {
        id: ISSUER_RELEVANCE_CRITERION_ID,
        matched: false,
        note: "about a different market",
      },
    ];

    const result = scoreFromEvaluations(evaluations, criteria, true);

    expect(result.reason).toContain("not relevant to issuer context");
    expect(result.reason).toContain("about a different market");
    expect(result.reason).not.toContain("no issuer-relevance verdict");
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

describe("scoreFromEvaluations — foreign symbol homonym", () => {
  it("rejects with a collision reason even when every rule matched and the gate passed", () => {
    const evaluations: CriterionEvaluation[] = [
      ...evaluate(allIds),
      {
        id: ISSUER_RELEVANCE_CRITERION_ID,
        matched: true,
        note: "names the issuer symbol",
      },
    ];

    const result = scoreFromEvaluations(
      evaluations,
      criteria,
      true,
      true,
      true,
    );

    expect(result.section).toBeNull();
    expect(result.score).toBe(0);
    expect(result.reason).toContain("ticker symbol collision");
  });

  it("prefers the collision reason over the no-judgments reason", () => {
    const result = scoreFromEvaluations([], criteria, true, false, true);

    expect(result.reason).toContain("ticker symbol collision");
    expect(result.reason).not.toContain("no rule judgments");
  });

  it("leaves classification untouched when no collision was detected", () => {
    const evaluations: CriterionEvaluation[] = [
      ...evaluate(["ip1", "ip3", "ip4"]),
      {
        id: ISSUER_RELEVANCE_CRITERION_ID,
        matched: true,
        note: "about the issuer",
      },
    ];

    const result = scoreFromEvaluations(
      evaluations,
      criteria,
      true,
      false,
      false,
    );

    expect(result.section).toBe("industryPulse");
  });
});

describe("scoreFromEvaluations — excluded sections", () => {
  it("never returns a section the source is closed to", () => {
    const result = scoreFromEvaluations(
      evaluate(["ip1", "ip2", "ip3", "ip4", "ip5"]),
      criteria,
      false,
      false,
      false,
      new Set(["industryPulse"]),
    );

    expect(result.section).not.toBe("industryPulse");
  });

  it("lets the article win its next-best section rather than dropping it", () => {
    const result = scoreFromEvaluations(
      evaluate(["ip1", "ip2", "ip3", "cl1", "cl2"]),
      criteria,
      false,
      false,
      false,
      new Set(["industryPulse"]),
    );

    expect(result.section).toBe("competitiveLandscape");
  });

  it("rejects when every section the article matched is closed to it", () => {
    const result = scoreFromEvaluations(
      evaluate(["ip1", "ip2"]),
      criteria,
      false,
      false,
      false,
      new Set(["industryPulse", "competitiveLandscape"]),
    );

    expect(result.section).toBeNull();
  });

  it("changes nothing when the exclusion set is empty", () => {
    const result = scoreFromEvaluations(
      evaluate(["ip1", "ip3", "ip4"]),
      criteria,
      false,
      false,
      false,
      new Set(),
    );

    expect(result.section).toBe("industryPulse");
  });
});

/**
 * competitiveLandscape carrying its real rule ids, three of which are market anchors. Mirrors the
 * shape the classifier returned for peer-only articles in the 2026-08-04 batch.
 */
const anchorCriteria: AcceptanceCriteriaRule[] = [
  {
    section: "competitiveLandscape",
    criteria: [
      {
        id: "cl-peer-named",
        text: "Include if a peer is named.",
        qualifying: true,
      },
      {
        id: "cl-peer-action",
        text: "Include if the peer acted.",
        qualifying: true,
      },
      {
        id: "cl-market-overlap",
        text: "Include if the markets overlap.",
        qualifying: true,
      },
      {
        id: "cl-relative-dynamic",
        text: "Include if standing shifted.",
        qualifying: false,
      },
      {
        id: "cl-issuer-side",
        text: "Include if the issuer is on one side.",
        qualifying: false,
      },
    ],
  },
];

const anchorEvaluations = (
  matchedIds: string[],
  gate: boolean | undefined,
): CriterionEvaluation[] => {
  const rows: CriterionEvaluation[] = anchorCriteria.flatMap((rule) =>
    rule.criteria.map((criterion) => ({
      id: criterion.id,
      matched: matchedIds.includes(criterion.id),
      note: matchedIds.includes(criterion.id) ? "evidence present" : "absent",
    })),
  );

  if (gate !== undefined) {
    rows.push({
      id: ISSUER_RELEVANCE_CRITERION_ID,
      matched: gate,
      note: gate ? "concerns the issuer" : "the article is about a competitor",
    });
  }

  return rows;
};

describe("scoreFromEvaluations — market-anchor override of the issuer gate", () => {
  it("admits a peer-only article the gate rejected once two anchors matched", () => {
    const result = scoreFromEvaluations(
      anchorEvaluations(
        ["cl-peer-named", "cl-peer-action", "cl-market-overlap"],
        false,
      ),
      anchorCriteria,
      true,
    );

    expect(result.section).toBe("competitiveLandscape");
    expect(result.score).toBeCloseTo(0.6);
    expect(result.reason).toContain("Issuer gate returned false");
    // cl-peer-action is not an anchor: it reports what the peer did, not where it operates.
    expect(result.scoreBreakdown.issuerRelevance).toEqual({
      matched: false,
      note: "the article is about a competitor",
      marketAnchors: 2,
      overridden: true,
    });
  });

  it("still rejects when only one anchor matched, so a coincidental name match cannot pass", () => {
    const result = scoreFromEvaluations(
      anchorEvaluations(["cl-peer-named"], false),
      anchorCriteria,
      true,
    );

    expect(result.section).toBeNull();
    expect(result.reason).toContain("not relevant to issuer context");
    expect(result.scoreBreakdown.issuerRelevance).toEqual({
      matched: false,
      note: "the article is about a competitor",
      marketAnchors: 1,
      overridden: false,
    });
  });

  it("overrides an omitted gate judgment on the same evidence bar", () => {
    const result = scoreFromEvaluations(
      anchorEvaluations(
        ["cl-peer-named", "cl-peer-action", "cl-market-overlap"],
        undefined,
      ),
      anchorCriteria,
      true,
    );

    expect(result.section).toBe("competitiveLandscape");
    expect(result.scoreBreakdown.issuerRelevance?.overridden).toBe(true);
  });

  it("records the gate without claiming an override when the gate matched", () => {
    const result = scoreFromEvaluations(
      anchorEvaluations(
        ["cl-peer-named", "cl-peer-action", "cl-market-overlap"],
        true,
      ),
      anchorCriteria,
      true,
    );

    expect(result.section).toBe("competitiveLandscape");
    expect(result.reason).not.toContain("Issuer gate returned false");
    expect(result.scoreBreakdown.issuerRelevance).toEqual({
      matched: true,
      note: "concerns the issuer",
      marketAnchors: 2,
      overridden: false,
    });
  });

  it("omits the issuer-relevance record when the gate was not required", () => {
    const result = scoreFromEvaluations(
      anchorEvaluations(["cl-peer-named", "cl-peer-action"], false),
      anchorCriteria,
    );

    expect(result.scoreBreakdown.issuerRelevance).toBeUndefined();
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

/** A single section carrying its real issuer-relevance rule id (`dm-market-link`). */
const issuerCapCriteria: AcceptanceCriteriaRule[] = [
  {
    section: "dealsAndMovements",
    criteria: [
      {
        id: "dm-corporate-action",
        text: "Include if a corporate action is reported.",
        qualifying: false,
      },
      {
        id: "dm-parties-named",
        text: "Include if the parties are named.",
        qualifying: false,
      },
      {
        id: "dm-market-link",
        text: "Include if the acting party operates in the issuer's market.",
        qualifying: false,
      },
      {
        id: "dm-terms-stated",
        text: "Include if terms are stated.",
        qualifying: false,
      },
      {
        id: "dm-confirmed",
        text: "Include if the action is confirmed.",
        qualifying: false,
      },
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
        "dm-corporate-action",
        "dm-parties-named",
        "dm-terms-stated",
      ]),
      issuerCapCriteria,
    );

    expect(result.section).toBe("dealsAndMovements");
    expect(result.score).toBe(0.4);
    expect(result.scoreBreakdown.matched).toBe(3);
    expect(result.reason).toContain("dm-market-link unmatched");
  });

  it("keeps the full score when the issuer-relevance rule is matched", () => {
    const result = scoreFromEvaluations(
      evaluateIssuerCap([
        "dm-corporate-action",
        "dm-parties-named",
        "dm-market-link",
        "dm-terms-stated",
      ]),
      issuerCapCriteria,
    );

    expect(result.section).toBe("dealsAndMovements");
    expect(result.score).toBe(0.8);
    expect(result.reason).not.toContain("capped");
  });

  it("does not raise a score already below the cap", () => {
    const result = scoreFromEvaluations(
      evaluateIssuerCap(["dm-corporate-action"]),
      issuerCapCriteria,
    );

    expect(result.score).toBe(0.2);
  });

  it("no longer caps competitiveLandscape when the issuer is absent from a peer story", () => {
    const competitiveLandscapeCriteria: AcceptanceCriteriaRule[] = [
      {
        section: "competitiveLandscape",
        criteria: [
          {
            id: "cl-peer-named",
            text: "Include if a peer is named.",
            qualifying: true,
          },
          {
            id: "cl-peer-action",
            text: "Include if the peer acted.",
            qualifying: true,
          },
          {
            id: "cl-market-overlap",
            text: "Include if the markets overlap.",
            qualifying: true,
          },
          {
            id: "cl-relative-dynamic",
            text: "Include if standing shifted.",
            qualifying: false,
          },
          {
            id: "cl-issuer-side",
            text: "Include if the issuer is on one side.",
            qualifying: false,
          },
        ],
      },
    ];
    const evaluations: CriterionEvaluation[] = [
      { id: "cl-peer-named", matched: true, note: "names the peer" },
      { id: "cl-peer-action", matched: true, note: "reports earnings" },
      { id: "cl-market-overlap", matched: true, note: "same nickel market" },
      { id: "cl-relative-dynamic", matched: true, note: "share shifted" },
      { id: "cl-issuer-side", matched: false, note: "issuer not named" },
    ];
    const result = scoreFromEvaluations(
      evaluations,
      competitiveLandscapeCriteria,
    );

    expect(result.section).toBe("competitiveLandscape");
    expect(result.score).toBe(0.8);
    expect(result.reason).not.toContain("capped");
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
        criteria: [
          { id: "ip1", text: "Include if macro (edited).", qualifying: false },
        ],
      },
    ];

    expect(criteriaHash(criteria)).toBe(criteriaHash(criteria));
    expect(criteriaHash(criteria)).not.toBe(criteriaHash(edited));
  });
});

describe("sectionsClosedToSource", () => {
  it("closes Issuer Performance when the article never names the issuer", () => {
    const closed = sectionsClosedToSource({
      url: "https://www.cnbcindonesia.com/news/bri-kkb-national-expo",
      requireIssuerRelevance: true,
      issuerNamedInArticle: false,
    });

    expect([...closed]).toStrictEqual(["issuerPerformance"]);
  });

  it("leaves Issuer Performance open when the article names the issuer", () => {
    const closed = sectionsClosedToSource({
      url: "https://www.cnbcindonesia.com/news/bank-raya-q2",
      requireIssuerRelevance: true,
      issuerNamedInArticle: true,
    });

    expect([...closed]).toStrictEqual([]);
  });

  it("stays inert when no issuer context was supplied", () => {
    const closed = sectionsClosedToSource({
      url: "https://www.cnbcindonesia.com/news/bri-kkb-national-expo",
      requireIssuerRelevance: false,
      issuerNamedInArticle: false,
    });

    expect([...closed]).toStrictEqual([]);
  });

  it("still closes Issuer Performance to a reader-contributed host that names the issuer", () => {
    const closed = sectionsClosedToSource({
      url: "https://www.readers.id/laba-bersih-naik",
      requireIssuerRelevance: true,
      issuerNamedInArticle: true,
    });

    expect([...closed]).toStrictEqual(["issuerPerformance"]);
  });

  it("lists Issuer Performance once when both rules close it", () => {
    const closed = sectionsClosedToSource({
      url: "https://www.readers.id/laba-bersih-naik",
      requireIssuerRelevance: true,
      issuerNamedInArticle: false,
    });

    expect([...closed]).toStrictEqual(["issuerPerformance"]);
  });
});

describe("issuerPerformance section", () => {
  const seeded = () => articleAnalysisConfigSchema.parse({}).acceptanceCriteria;

  it("gates on the issuer being the subject and on a reported result", () => {
    const qualifyingIds = flattenAcceptanceCriteria(seeded())
      .filter(
        (criterion) =>
          criterion.section === "issuerPerformance" && criterion.qualifying,
      )
      .map((criterion) => criterion.id);

    expect(qualifyingIds).toEqual(["pf-issuer-subject", "pf-reported-result"]);
  });

  it("stays uncapped, since winning it already asserts issuer relevance", () => {
    const issuerPerformanceIds = flattenAcceptanceCriteria(seeded())
      .filter((criterion) => criterion.section === "issuerPerformance")
      .map((criterion) => criterion.id);

    for (const ruleId of issuerPerformanceIds) {
      expect(ISSUER_RELEVANCE_RULE_IDS.has(ruleId)).toBe(false);
    }
  });

  it("treats the issuer being the article's subject as a market anchor", () => {
    expect(MARKET_ANCHOR_RULE_IDS.has("pf-issuer-subject")).toBe(true);
  });

  it("outranks every other section when an issuer earnings article qualifies for both", () => {
    const config = articleAnalysisConfigSchema.parse({});
    const evaluations: CriterionEvaluation[] = flattenAcceptanceCriteria(
      config.acceptanceCriteria,
    ).map((criterion) => ({
      id: criterion.id,
      matched:
        criterion.section === "issuerPerformance" ||
        criterion.section === "dealsAndMovements",
      note: "n",
    }));
    evaluations.push({
      id: ISSUER_RELEVANCE_CRITERION_ID,
      matched: true,
      note: "issuer",
    });

    const result = scoreFromEvaluations(
      evaluations,
      config.acceptanceCriteria,
      true,
    );

    expect(result.section).toBe("issuerPerformance");
  });

  it("accepts an issuer earnings article that qualifies for no other section", () => {
    const config = articleAnalysisConfigSchema.parse({});
    const evaluations: CriterionEvaluation[] = flattenAcceptanceCriteria(
      config.acceptanceCriteria,
    ).map((criterion) => ({
      id: criterion.id,
      matched: criterion.section === "issuerPerformance",
      note: "n",
    }));
    evaluations.push({
      id: ISSUER_RELEVANCE_CRITERION_ID,
      matched: true,
      note: "issuer",
    });

    const result = scoreFromEvaluations(
      evaluations,
      config.acceptanceCriteria,
      true,
    );

    expect(result.section).toBe("issuerPerformance");
    expect(result.reason).not.toContain("No section met its qualifying rules");
  });

  it("recovers an issuer article the gate wrongly rejected, via the market anchors", () => {
    const config = articleAnalysisConfigSchema.parse({});
    const evaluations: CriterionEvaluation[] = flattenAcceptanceCriteria(
      config.acceptanceCriteria,
    ).map((criterion) => ({
      id: criterion.id,
      matched:
        criterion.section === "issuerPerformance" ||
        criterion.id === "qh-market-actor",
      note: "n",
    }));
    evaluations.push({
      id: ISSUER_RELEVANCE_CRITERION_ID,
      matched: false,
      note: "does not mention the issuer",
    });

    const result = scoreFromEvaluations(
      evaluations,
      config.acceptanceCriteria,
      true,
    );

    expect(result.section).toBe("issuerPerformance");
    expect(result.scoreBreakdown.issuerRelevance?.overridden).toBe(true);
  });
});
