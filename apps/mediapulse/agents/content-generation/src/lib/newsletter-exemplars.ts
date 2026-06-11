import type { IndustryNewsletterStructure } from "../industry-newsletter-schema.js";
import type { SourceForGeneration } from "../types.js";

/** Sector tag used to pick voice-calibration exemplars for newsletter generation. */
export type NewsletterExemplarSectorTag =
  | "industrial"
  | "consumer"
  | "financial"
  | "tech"
  | "commodities";

/** Hand-curated few-shot newsletter exemplar (fictional ticker and articles). */
export type NewsletterExemplar = {
  id: string;
  sectorTag: NewsletterExemplarSectorTag;
  tickerName: string;
  tickerSymbol: string;
  sourceTitles: string[];
  output: IndustryNewsletterStructure;
};

/** Disclaimer prepended before each exemplar block in the user prompt. */
export const EXEMPLAR_PROMPT_DISCLAIMER =
  "Below is an exemplar of the briefing style we expect. Do NOT copy specific facts — the exemplar's articles are fictional. Use it to calibrate tone, bullet length, and heading creativity.";

const CONSUMER_FINANCIAL_KEYWORDS = [
  "bank",
  "finance",
  "financial",
  "consumer",
  "lending",
  "deposit",
  "deposits",
  "retail",
  "credit",
  "mortgage",
  "payment",
  "fintech",
  "insurance",
] as const;

/**
 * Fictional industrial conglomerate exemplar — mining, infrastructure, and palm oil lens.
 */
const industrialExemplar: NewsletterExemplar = {
  id: "industrial-INDX",
  sectorTag: "industrial",
  tickerName: "Indo Nexus Holdings",
  tickerSymbol: "INDX",
  sourceTitles: [
    "INDX unit wins $420M port dredging package in Kalimantan",
    "Nickel smelter JV delays startup as power tariff talks stall",
    "Palm oil export levy revision splits plantation peers",
    "Heavy-equipment rental margins compress on fleet oversupply",
    "Government fast-tracks industrial estate permits in Batam",
    "Coal benchmark softens; miners pivot capex to downstream metals",
  ],
  output: {
    subject: "INDX: ports, nickel, and the quiet quarter in heavy industry",
    industryPulse: {
      displayHeading: "When boring works",
      prose:
        "Heavy-industry names entered the week with muted headlines — no blockbuster M&A, no surprise guidance cuts. That flat surface hides a split screen: export-linked miners are absorbing softer coal benchmarks while infrastructure and dredging backlogs keep order books visible through 2027.",
    },
    competitiveLandscape: {
      displayHeading: "Who is stealing share quietly",
      bullets: [
        {
          title: "Port contract landed despite rival underbids",
          text: "Regional dredging rivals underbid on two Kalimantan packages last month, but INDX's consortium still landed the $420M port contract by bundling financing with local content guarantees cited in the tender documents.",
          articleIndex: 1,
        },
        {
          title: "Fleet oversupply dents day-rate spreads",
          text: "Fleet oversupply in rented excavators and haul trucks is squeezing day-rate spreads for every contractor serving smelter builds, which explains why even market leaders are talking about utilization before volume growth.",
          articleIndex: 4,
        },
        {
          title: "Plantation peers split on levy impact",
          text: "Plantation peers diverged after the export-levy tweak: integrated processors with domestic refining capacity framed the change as neutral, while pure exporters warned margin pressure into the second half.",
          articleIndex: 3,
        },
      ],
    },
    dealsAndMovements: {
      displayHeading: "Capital in motion",
      bullets: [
        {
          title: "Kalimantan dredging award anchors multi-year revenue",
          text: "The Kalimantan dredging award is the week's clearest deal signal — it locks in multi-year earthworks revenue and gives INDX a reference project when bidding the next wave of port upgrades along the nickel corridor.",
          articleIndex: 1,
        },
        {
          title: "Capex shifting from coal to downstream metals",
          text: "Miners reallocating capex from thermal coal toward downstream metals are reshaping the supplier queue: equipment lessors and EPC firms that leaned on coal maintenance contracts are now pitching modular smelter packages instead.",
          articleIndex: 6,
        },
      ],
    },
    regulatoryPolicyWatch: {
      displayHeading: "Permits and levies",
      bullets: [
        {
          title: "Batam permit acceleration lifts equipment demand outlook",
          text: "Batam industrial-estate permit acceleration is the policy story to watch for heavy-equipment demand — faster land release usually precedes a six-to-nine-month spike in civil works and crane rentals across the region.",
          articleIndex: 5,
        },
        {
          title: "Palm oil levy revision remains cash-flow swing factor",
          text: "Palm oil levy revisions remain the swing factor for plantation cash flows this quarter; the split reaction among peers suggests investors should track who hedged export exposure versus who stayed spot-heavy.",
          articleIndex: 3,
        },
      ],
    },
    disruptorsOrTech: {
      format: "bullets",
      displayHeading: "Power and process tech",
      bullets: [
        {
          title: "Power tariffs gate smelter startups more than ore grades",
          text: "Nickel smelter JV startup delays tied to power-tariff negotiations highlight how electricity pricing — not ore grades — is becoming the gating item for new Indonesian processing capacity.",
          articleIndex: 2,
        },
        {
          title: "Modular smelters and fleet telemetry lead contractor pitches",
          text: "Modular smelter designs and digital fleet telemetry are the two technologies contractors cite most when pitching shorter build cycles to miners pivoting away from coal.",
          articleIndex: 6,
        },
      ],
    },
    quickHits: {
      displayHeading: "Quick hits",
      items: [
        {
          title: "$420M Kalimantan dredging contract signed",
          text: "INDX-led consortium signed the $420M Kalimantan dredging package.",
          articleIndex: 1,
        },
        {
          title: "Nickel JV startup delayed by tariff talks",
          text: "Nickel JV pushed commercial startup as tariff talks with the utility dragged.",
          articleIndex: 2,
        },
        {
          title: "Levy change split plantation margin outlook",
          text: "Export levy change split plantation peers on margin outlook.",
          articleIndex: 3,
        },
        {
          title: "Equipment rental spreads narrowed on oversupply",
          text: "Equipment rental spreads narrowed on fleet oversupply.",
          articleIndex: 4,
        },
        {
          title: "Batam industrial permits fast-tracked",
          text: "Batam industrial permits on a fast track.",
          articleIndex: 5,
        },
        {
          title: "Coal softness accelerates downstream capex shift",
          text: "Coal benchmark softness accelerated capex shifts to downstream metals.",
          articleIndex: 6,
        },
      ],
    },
  },
};

/**
 * Fictional consumer and financial mix exemplar — banking, retail, and payments lens.
 */
const consumerFinancialExemplar: NewsletterExemplar = {
  id: "consumer-CONSM",
  sectorTag: "consumer",
  tickerName: "Consumer Axis Group",
  tickerSymbol: "CONSM",
  sourceTitles: [
    "Central bank holds rate; lenders widen net interest margin guidance",
    "Fast-moving consumer goods brands chase promo efficiency as input costs ease",
    "Digital wallet transaction growth slows in tier-2 cities",
    "Department store footfall rebounds but basket size stays flat",
    "Micro-lending platforms face tighter know-your-customer audits",
    "Consumer confidence survey ticks up on stable food prices",
  ],
  output: {
    subject: "CONSM: margins, wallets, and a cautious consumer reopening",
    industryPulse: {
      displayHeading: "The quiet quarter",
      prose:
        "Consumer-facing names are narrating stability more than acceleration — rates on hold, food inflation easing, footfall up but wallets not stretching. The sector story is margin management: lenders widening NIM guidance while retailers and wallets fight for share without burning promo budgets.",
    },
    competitiveLandscape: {
      displayHeading: "Share fights without price wars",
      bullets: [
        {
          title: "FMCG trade spend pivots to promo efficiency",
          text: "FMCG brands are redeploying trade spend toward promo efficiency rather than list-price cuts, a tell that input-cost relief is reaching shelves but volume growth remains fragile across categories.",
          articleIndex: 2,
        },
        {
          title: "Department stores gain footfall but not basket size",
          text: "Department stores logged footfall gains while average basket size flatlined — a pattern that favors operators with loyalty data and private-label mix over pure square-meter expansion plays.",
          articleIndex: 4,
        },
        {
          title: "Wallet growth stalls in tier-2 cities",
          text: "Digital wallet growth cooling in tier-2 cities suggests the easy user-acquisition phase is over; incumbents are competing on merchant rebates and cross-sell into lending rather than raw transaction counts.",
          articleIndex: 3,
        },
      ],
    },
    dealsAndMovements: {
      displayHeading: "Balance-sheet moves",
      bullets: [
        {
          title: "NIM guidance raised on deposit repricing, not loan demand",
          text: "Lenders raising net interest margin guidance while the policy rate stays unchanged implies deposit repricing and asset-yield mix shifts — not necessarily stronger loan demand — which matters for how you read upcoming earnings beats.",
          articleIndex: 1,
        },
        {
          title: "KYC audits may consolidate micro-lending to incumbents",
          text: "Micro-lending platforms facing tighter KYC audits may consolidate origination volumes toward balance-sheet lenders with compliance headroom, a subtle share shift for consumer finance incumbents.",
          articleIndex: 5,
        },
      ],
    },
    regulatoryPolicyWatch: {
      displayHeading: "Rates and rules",
      bullets: [
        {
          title: "Rate hold steadies borrowing costs but NIM pressure lingers",
          text: "The hold on benchmark rates keeps consumer borrowing costs predictable in the near term, but lenders' widened NIM outlook signals they still expect funding-cost pressure from deposit competition.",
          articleIndex: 1,
        },
        {
          title: "Stricter KYC links wallet slowdowns to origination risk",
          text: "Stricter KYC enforcement on micro-lenders is the regulatory thread tying together wallet slowdowns and origination risk — expect more partnership models with licensed banks rather than standalone apps.",
          articleIndex: 5,
        },
      ],
    },
    disruptorsOrTech: {
      format: "prose",
      displayHeading: "Payments and personalization",
      prose:
        "Wallet apps are pivoting from transaction growth to embedded lending and merchant incentives, while retailers lean on loyalty analytics to lift basket mix without broad discounting — both are tech-enabled margin stories more than top-line surprises.",
    },
    quickHits: {
      displayHeading: "Quick hits",
      items: [
        {
          title: "Rate held; NIM guidance lifted",
          text: "Policy rate unchanged; lenders guided wider NIMs.",
          articleIndex: 1,
        },
        {
          title: "FMCG promos optimized on easing input costs",
          text: "FMCG promos tuned for efficiency as input costs eased.",
          articleIndex: 2,
        },
        {
          title: "Wallet growth slowed in tier-2 cities",
          text: "Wallet transaction growth slowed in tier-2 cities.",
          articleIndex: 3,
        },
        {
          title: "Department store traffic up, baskets flat",
          text: "Department store traffic up, baskets flat.",
          articleIndex: 4,
        },
        {
          title: "Micro-lenders face tighter KYC scrutiny",
          text: "Micro-lenders face tighter KYC audits.",
          articleIndex: 5,
        },
        {
          title: "Consumer confidence up on stable food prices",
          text: "Consumer confidence improved on stable food prices.",
          articleIndex: 6,
        },
      ],
    },
  },
};

/** Curated few-shot newsletter exemplars in deterministic bank order. */
export const NEWSLETTER_EXEMPLAR_BANK: readonly NewsletterExemplar[] = [
  industrialExemplar,
  consumerFinancialExemplar,
];

/**
 * Returns true when the haystack text matches consumer/financial sector keywords.
 *
 * @param haystack - Lowercased concatenation of ticker name and source titles.
 */
export const matchesConsumerFinancialKeywords = (haystack: string): boolean => {
  return CONSUMER_FINANCIAL_KEYWORDS.some((keyword) =>
    haystack.includes(keyword),
  );
};

/**
 * Selects 1–2 exemplars for a ticker using keyword heuristics or an explicit sector pin.
 *
 * @param tickerSymbol - Exchange symbol for the ticker being processed.
 * @param tickerName - Human-readable company name.
 * @param sources - Sources that will appear in the prompt (titles used for matching).
 * @param options - Optional sector pin and max count from config.
 * @returns Ordered exemplar list (at most `maxExemplars`).
 */
export const pickExemplarsForTicker = (
  tickerSymbol: string,
  tickerName: string,
  sources: readonly SourceForGeneration[],
  options: {
    maxExemplars?: number;
    sectorTag?: NewsletterExemplarSectorTag;
  } = {},
): NewsletterExemplar[] => {
  const maxExemplars = options.maxExemplars ?? 1;
  const haystack = [
    tickerName,
    tickerSymbol,
    ...sources.map((source) => source.title),
  ]
    .join(" ")
    .toLowerCase();

  if (options.sectorTag !== undefined) {
    const pinned = NEWSLETTER_EXEMPLAR_BANK.filter(
      (exemplar) => exemplar.sectorTag === options.sectorTag,
    );
    if (pinned.length > 0) {
      return pinned.slice(0, maxExemplars);
    }
  }

  const preferred = matchesConsumerFinancialKeywords(haystack)
    ? consumerFinancialExemplar
    : industrialExemplar;

  if (maxExemplars >= 2) {
    const secondary =
      preferred.id === industrialExemplar.id
        ? consumerFinancialExemplar
        : industrialExemplar;
    return [preferred, secondary];
  }

  return [preferred];
};

/**
 * Formats one bullet line for the prose exemplar block.
 *
 * @param text - Bullet body text.
 * @param articleIndex - Optional 1-based article citation.
 */
const formatBulletLine = (text: string, articleIndex?: number): string => {
  const citation =
    articleIndex !== undefined
      ? ` (cited Article ${String(articleIndex)})`
      : "";
  return `- ${text}${citation}`;
};

/**
 * Renders one exemplar as a prose-anchored fenced block for few-shot voice calibration.
 *
 * @param exemplar - Curated exemplar definition.
 * @returns Multi-line prose block bounded by `EXEMPLAR —` / `END EXEMPLAR`.
 */
export const formatExemplarBlock = (exemplar: NewsletterExemplar): string => {
  const { output } = exemplar;
  const lines: string[] = [
    `EXEMPLAR — ${exemplar.sectorTag} sector`,
    `Subject: ${output.subject}`,
    `Industry Pulse / ${output.industryPulse.displayHeading}:`,
    output.industryPulse.prose,
    `Competitive Landscape / ${output.competitiveLandscape.displayHeading}:`,
    ...output.competitiveLandscape.bullets.map((bullet) =>
      formatBulletLine(bullet.text, bullet.articleIndex),
    ),
    `Deals and Movements / ${output.dealsAndMovements.displayHeading}:`,
    ...output.dealsAndMovements.bullets.map((bullet) =>
      formatBulletLine(bullet.text, bullet.articleIndex),
    ),
    `Regulatory & Policy Watch / ${output.regulatoryPolicyWatch.displayHeading}:`,
    ...output.regulatoryPolicyWatch.bullets.map((bullet) =>
      formatBulletLine(bullet.text, bullet.articleIndex),
    ),
  ];

  if (output.disruptorsOrTech.format === "prose") {
    lines.push(
      `Disruptors or Tech / ${output.disruptorsOrTech.displayHeading}:`,
      output.disruptorsOrTech.prose,
    );
  } else {
    lines.push(
      `Disruptors or Tech / ${output.disruptorsOrTech.displayHeading}:`,
    );
    lines.push(
      ...output.disruptorsOrTech.bullets.map((bullet) =>
        formatBulletLine(bullet.text, bullet.articleIndex),
      ),
    );
  }

  lines.push(`Quick Hits / ${output.quickHits.displayHeading}:`);
  lines.push(
    ...output.quickHits.items.map((item) =>
      formatBulletLine(item.text, item.articleIndex),
    ),
  );

  lines.push("END EXEMPLAR");
  return lines.join("\n");
};

/**
 * Builds the full exemplar section injected before `{{sourceSummaries}}`.
 *
 * @param exemplars - Selected exemplars for this run.
 * @returns Disclaimer plus one formatted block per exemplar.
 */
export const buildExemplarPromptSection = (
  exemplars: readonly NewsletterExemplar[],
): string => {
  if (exemplars.length === 0) {
    return "";
  }

  const blocks = exemplars.map((exemplar) => formatExemplarBlock(exemplar));
  return [EXEMPLAR_PROMPT_DISCLAIMER, ...blocks].join("\n\n");
};

/**
 * Tokenizes text into lowercase word tokens for Jaccard similarity.
 *
 * @param text - Raw bullet or prose string.
 */
export const tokenizeForJaccard = (text: string): Set<string> => {
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g);
  return new Set(tokens ?? []);
};

/**
 * Computes Jaccard similarity between two token sets.
 *
 * @param left - First token set.
 * @param right - Second token set.
 */
export const jaccardSimilarity = (
  left: Set<string>,
  right: Set<string>,
): number => {
  if (left.size === 0 && right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

/**
 * Collects bullet and quick-hit text from a newsletter structure for overlap checks.
 *
 * @param structure - Parsed newsletter JSON.
 */
export const collectBulletTexts = (
  structure: IndustryNewsletterStructure,
): string[] => {
  const texts: string[] = [
    ...structure.competitiveLandscape.bullets.map((bullet) => bullet.text),
    ...structure.dealsAndMovements.bullets.map((bullet) => bullet.text),
    ...structure.regulatoryPolicyWatch.bullets.map((bullet) => bullet.text),
    ...structure.quickHits.items.map((item) => item.text),
  ];

  if (structure.disruptorsOrTech.format === "bullets") {
    texts.push(
      ...structure.disruptorsOrTech.bullets.map((bullet) => bullet.text),
    );
  }

  return texts;
};

/** Result of comparing generated bullets against an active exemplar. */
export type ExemplarPlagiarismCheckResult = {
  /** Highest Jaccard score across bullet pairs. */
  maxSimilarity: number;
  /** True when `maxSimilarity` exceeds the configured threshold. */
  possiblyPlagiarized: boolean;
};

/** Default Jaccard threshold for exemplar overlap warnings. */
export const EXEMPLAR_PLAGIARISM_JACCARD_THRESHOLD = 0.6;

/**
 * Compares generated newsletter bullets to an exemplar using local Jaccard similarity.
 *
 * @param generated - LLM output for the live run.
 * @param exemplar - Active few-shot exemplar for this run.
 * @param threshold - Similarity above which a warning should fire.
 */
export const detectExemplarPlagiarism = (
  generated: IndustryNewsletterStructure,
  exemplar: NewsletterExemplar,
  threshold: number = EXEMPLAR_PLAGIARISM_JACCARD_THRESHOLD,
): ExemplarPlagiarismCheckResult => {
  const generatedTexts = collectBulletTexts(generated);
  const exemplarTexts = collectBulletTexts(exemplar.output);

  let maxSimilarity = 0;
  for (const generatedText of generatedTexts) {
    const generatedTokens = tokenizeForJaccard(generatedText);
    for (const exemplarText of exemplarTexts) {
      const score = jaccardSimilarity(
        generatedTokens,
        tokenizeForJaccard(exemplarText),
      );
      if (score > maxSimilarity) {
        maxSimilarity = score;
      }
    }
  }

  return {
    maxSimilarity,
    possiblyPlagiarized: maxSimilarity > threshold,
  };
};

/**
 * Estimates combined character length of source summaries for budget checks.
 *
 * @param sources - Sources that will be rendered as Article N blocks.
 */
export const estimateSourceSummariesChars = (
  sources: readonly SourceForGeneration[],
): number => {
  return sources
    .map(
      (source, index) =>
        `Article ${String(index + 1)}: ${source.title}\n${source.content}`,
    )
    .join("\n\n---\n\n").length;
};

/**
 * Drops least-relevant sources from the end until exemplar + source text fits the cap.
 *
 * Truncation order when few-shot is enabled: sources from the end first; exemplars are
 * never dropped because they calibrate voice even when source coverage is tight.
 *
 * @param sources - Selected sources in prompt order (most relevant first).
 * @param exemplarSection - Pre-rendered exemplar prompt block.
 * @param maxTotalContextChars - Configured combined source character budget.
 */
export const fitSourcesForExemplarBudget = (
  sources: SourceForGeneration[],
  exemplarSection: string,
  maxTotalContextChars: number,
): {
  sources: SourceForGeneration[];
  sourcesDroppedForExemplarSpace: number;
} => {
  const exemplarChars = exemplarSection.length;
  const fitted = [...sources];
  let sourcesDroppedForExemplarSpace = 0;

  while (
    fitted.length > 1 &&
    exemplarChars + estimateSourceSummariesChars(fitted) > maxTotalContextChars
  ) {
    fitted.pop();
    sourcesDroppedForExemplarSpace += 1;
  }

  return { sources: fitted, sourcesDroppedForExemplarSpace };
};
