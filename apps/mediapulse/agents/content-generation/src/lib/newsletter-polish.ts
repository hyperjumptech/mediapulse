import type { IndustryNewsletterStructure } from "../industry-newsletter-schema.js";
import { industryNewsletterStructureSchema } from "../industry-newsletter-schema.js";

/** One deterministic prose cleanup rule in the polish bank. */
export type PolishRule = {
  id: string;
  pattern: RegExp;
  replacement: string | ((match: RegExpMatchArray) => string);
  description: string;
  tier: "aggressive" | "safe";
};

/** Per-rule firing counts from a polish pass. */
export type PolishReport = {
  ruleId: string;
  count: number;
};

/** Options for {@link polishNewsletter}. */
export type PolishNewsletterOptions = {
  /** `safe` runs filler, hedge, and register rules; `aggressive` also runs overused-word replacement. */
  tier: "safe" | "aggressive";
  /** Rule ids to skip (operator escape hatch). */
  disabledRuleIds: readonly string[];
};

/** Result of {@link polishNewsletter}. */
export type PolishNewsletterResult = {
  structure: IndustryNewsletterStructure;
  reports: PolishReport[];
  totalReplacements: number;
  rulesFired: Record<string, number>;
};

const OVERUSED_WORD_ALTERNATIVES: Record<string, string> = {
  robust: "strong",
  significant: "notable",
  noteworthy: "meaningful",
  compelling: "striking",
};

/** High-frequency Indonesian tokens for register detection (~30 words). */
const INDONESIAN_LEXICON = new Set([
  "dan",
  "atau",
  "yang",
  "dengan",
  "dari",
  "untuk",
  "pada",
  "ini",
  "itu",
  "adalah",
  "akan",
  "telah",
  "sudah",
  "belum",
  "tidak",
  "juga",
  "serta",
  "oleh",
  "ke",
  "di",
  "sebagai",
  "dalam",
  "kepada",
  "para",
  "bahwa",
  "agar",
  "namun",
  "karena",
  "sehingga",
  "antara",
  "lebih",
  "sangat",
]);

const INDONESIAN_CONNECTOR_PATTERN = /\b(?:dan|atau|yang|dengan)\b/gi;

/**
 * Replaces a prefix match and capitalizes the first letter of the remainder when needed.
 *
 * @param text - Input string.
 * @param pattern - Prefix pattern to remove.
 */
/** Clones a rule pattern so global regex state is not shared across fields. */
const clonePattern = (pattern: RegExp): RegExp =>
  new RegExp(pattern.source, pattern.flags);

const removePrefixPreserveCapitalization = (
  text: string,
  pattern: RegExp,
): { text: string; count: number } => {
  const activePattern = clonePattern(pattern);
  let count = 0;
  let removedAtStart = false;
  let next = text.replace(activePattern, (_match, offset) => {
    count += 1;
    if (offset === 0) {
      removedAtStart = true;
    }
    return "";
  });

  if (count > 0 && removedAtStart) {
    next = next.replace(/^\s*([a-z])/, (_whole, letter: string) =>
      letter.toUpperCase(),
    );
  }

  return { text: next, count };
};

/**
 * Applies a simple collocation replacement and returns how many times it fired.
 *
 * @param text - Input string.
 * @param pattern - Exact phrase pattern.
 * @param replacement - Replacement phrase.
 */
const applySimpleReplacement = (
  text: string,
  pattern: RegExp,
  replacement: string,
): { text: string; count: number } => {
  const activePattern = clonePattern(pattern);
  let count = 0;
  const next = text.replace(activePattern, () => {
    count += 1;
    return replacement;
  });
  return { text: next, count };
};

/**
 * Estimates whether a bullet is predominantly English (alpha words only).
 *
 * @param text - Bullet or prose string.
 */
export const englishWordRatio = (text: string): number => {
  const words = text.match(/[A-Za-z]+/g) ?? [];
  if (words.length === 0) {
    return 1;
  }
  let english = 0;
  let indonesian = 0;
  for (const word of words) {
    const lower = word.toLowerCase();
    if (INDONESIAN_LEXICON.has(lower)) {
      indonesian += 1;
    } else {
      english += 1;
    }
  }
  const total = english + indonesian;
  return total === 0 ? 1 : english / total;
};

/**
 * Strips Indonesian connector words from predominantly English bullets.
 *
 * @param text - Input bullet text.
 */
export const stripIndonesianConnectorsFromEnglishBullet = (
  text: string,
): { text: string; count: number } => {
  if (englishWordRatio(text) <= 0.7) {
    return { text, count: 0 };
  }
  const connectorPattern = clonePattern(INDONESIAN_CONNECTOR_PATTERN);
  let count = 0;
  const next = text
    .replace(connectorPattern, () => {
      count += 1;
      return " ";
    })
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
  return { text: next, count };
};

/** Hand-curated safe and aggressive polish rules in application order. */
export const NEWSLETTER_POLISH_RULES: readonly PolishRule[] = [
  {
    id: "filler-its-worth-noting",
    pattern: /It's worth noting that\s+/gi,
    replacement: "",
    description: "Remove It's worth noting that filler",
    tier: "safe",
  },
  {
    id: "filler-it-should-be-noted",
    pattern: /It should be noted that\s+/gi,
    replacement: "",
    description: "Remove It should be noted that filler",
    tier: "safe",
  },
  {
    id: "filler-as-mentioned",
    pattern: /As mentioned (?:earlier|previously),?\s+/gi,
    replacement: "",
    description: "Remove As mentioned earlier/previously filler",
    tier: "safe",
  },
  {
    id: "filler-importantly",
    pattern: /Importantly,?\s+/gi,
    replacement: "",
    description: "Remove Importantly opener",
    tier: "safe",
  },
  {
    id: "filler-notably",
    pattern: /Notably,?\s+/gi,
    replacement: "",
    description: "Remove Notably opener",
    tier: "safe",
  },
  {
    id: "filler-in-summary",
    pattern: /In summary,?\s+/gi,
    replacement: "",
    description: "Remove In summary opener",
    tier: "safe",
  },
  {
    id: "filler-overall",
    pattern: /Overall,?\s+(?:the\s+)?/gi,
    replacement: "",
    description: "Remove Overall opener",
    tier: "safe",
  },
  {
    id: "hedge-could-potentially",
    pattern: /\bcould potentially\b/gi,
    replacement: "could",
    description: "Collapse could potentially hedge stack",
    tier: "safe",
  },
  {
    id: "hedge-may-possibly",
    pattern: /\bmay possibly\b/gi,
    replacement: "may",
    description: "Collapse may possibly hedge stack",
    tier: "safe",
  },
  {
    id: "hedge-might-eventually",
    pattern: /\bmight eventually\b/gi,
    replacement: "might",
    description: "Collapse might eventually hedge stack",
    tier: "safe",
  },
  {
    id: "hedge-likely-to-potentially",
    pattern: /\bis likely to potentially\b/gi,
    replacement: "is likely to",
    description: "Collapse is likely to potentially hedge stack",
    tier: "safe",
  },
  {
    id: "register-mix-id-connectors",
    pattern: INDONESIAN_CONNECTOR_PATTERN,
    replacement: " ",
    description: "Strip Indonesian connectors from English-dominant bullets",
    tier: "safe",
  },
];

type MutableBulletRef = { text: string };

type BulletRef = {
  get: () => string;
  set: (value: string) => void;
};

/**
 * Collects mutable bullet text references across the newsletter structure.
 *
 * @param structure - Newsletter JSON.
 */
const collectBulletRefs = (
  structure: IndustryNewsletterStructure,
): BulletRef[] => {
  const refs: BulletRef[] = [];
  const pushBullets = (bullets: MutableBulletRef[]) => {
    for (const bullet of bullets) {
      refs.push({
        get: () => bullet.text,
        set: (value) => {
          bullet.text = value;
        },
      });
    }
  };

  pushBullets(structure.competitiveLandscape.bullets);
  pushBullets(structure.dealsAndMovements.bullets);
  pushBullets(structure.regulatoryPolicyWatch.bullets);
  if (structure.disruptorsOrTech.format === "bullets") {
    pushBullets(structure.disruptorsOrTech.bullets);
  }
  pushBullets(structure.quickHits.items);

  return refs;
};

type TextFieldRef = BulletRef;

/**
 * Collects all prose, bullet, quick-hit, summary, and quote fields to polish.
 *
 * @param structure - Newsletter JSON (mutated in place).
 */
const collectPolishTextRefs = (
  structure: IndustryNewsletterStructure,
): TextFieldRef[] => {
  const refs: TextFieldRef[] = [
    {
      get: () => structure.industryPulse.prose,
      set: (value) => {
        structure.industryPulse.prose = value;
      },
    },
  ];

  for (const ref of collectBulletRefs(structure)) {
    refs.push(ref);
  }

  const disruptors = structure.disruptorsOrTech;
  if (disruptors.format === "prose") {
    refs.push({
      get: () => disruptors.prose,
      set: (value) => {
        disruptors.prose = value;
      },
    });
  }

  const readWatchListen = structure.readWatchListen;
  if (readWatchListen !== undefined) {
    refs.push({
      get: () => readWatchListen.summary,
      set: (value) => {
        readWatchListen.summary = value;
      },
    });
  }

  const quoteOfTheWeek = structure.quoteOfTheWeek;
  if (quoteOfTheWeek !== undefined) {
    refs.push({
      get: () => quoteOfTheWeek.quote,
      set: (value) => {
        quoteOfTheWeek.quote = value;
      },
    });
  }

  return refs;
};

/**
 * Applies one polish rule to a single text field.
 *
 * @param text - Field text.
 * @param rule - Rule definition.
 */
const applyRuleToText = (
  text: string,
  rule: PolishRule,
): { text: string; count: number } => {
  if (rule.id === "register-mix-id-connectors") {
    return stripIndonesianConnectorsFromEnglishBullet(text);
  }

  if (typeof rule.replacement === "string" && rule.replacement === "") {
    return removePrefixPreserveCapitalization(text, rule.pattern);
  }

  if (typeof rule.replacement === "string") {
    return applySimpleReplacement(text, rule.pattern, rule.replacement);
  }

  if (typeof rule.replacement === "function") {
    const replaceFn = rule.replacement;
    const activePattern = clonePattern(rule.pattern);
    let count = 0;
    const next = text.replace(activePattern, (...args: unknown[]) => {
      count += 1;
      const match = args[0] as RegExpMatchArray;
      return replaceFn(match);
    });
    return { text: next, count };
  }

  return { text, count: 0 };
};

/**
 * Replaces at most one overused word in the briefing when it appears in 3+ bullets.
 *
 * @param structure - Newsletter JSON (mutated).
 * @param word - Overused token.
 * @param alternative - Replacement word.
 * @param counts - Mutable per-rule firing counts.
 */
const applyOverusedWordCap = (
  structure: IndustryNewsletterStructure,
  word: string,
  alternative: string,
  counts: Map<string, number>,
): void => {
  const ruleId = `overused-${word}`;
  const bulletRefs = collectBulletRefs(structure);
  const matching = bulletRefs.filter((ref) =>
    new RegExp(`\\b${word}\\b`, "i").test(ref.get()),
  );
  if (matching.length < 3) {
    return;
  }

  const target = matching[1];
  if (target === undefined) {
    return;
  }

  const current = target.get();
  const next = current.replace(new RegExp(`\\b${word}\\b`, "i"), alternative);
  if (next !== current) {
    target.set(next);
    counts.set(ruleId, (counts.get(ruleId) ?? 0) + 1);
  }
};

/**
 * Runs the deterministic style polish pass over newsletter prose fields.
 *
 * @param structure - Validated newsletter JSON from structured generation / critique.
 * @param opts - Tier and per-rule disable list.
 */
export const polishNewsletter = (
  structure: IndustryNewsletterStructure,
  opts: PolishNewsletterOptions,
): PolishNewsletterResult => {
  const disabled = new Set(opts.disabledRuleIds);
  const next = structuredClone(structure);
  const counts = new Map<string, number>();

  const enabledRules = NEWSLETTER_POLISH_RULES.filter((rule) => {
    if (disabled.has(rule.id)) {
      return false;
    }
    if (rule.tier === "aggressive" && opts.tier !== "aggressive") {
      return false;
    }
    return true;
  });

  for (const ref of collectPolishTextRefs(next)) {
    let text = ref.get();
    for (const rule of enabledRules) {
      const applied = applyRuleToText(text, rule);
      text = applied.text;
      if (applied.count > 0) {
        counts.set(rule.id, (counts.get(rule.id) ?? 0) + applied.count);
      }
    }
    ref.set(text);
  }

  if (opts.tier === "aggressive" && !disabled.has("overused-robust")) {
    applyOverusedWordCap(
      next,
      "robust",
      OVERUSED_WORD_ALTERNATIVES.robust!,
      counts,
    );
  }
  if (opts.tier === "aggressive" && !disabled.has("overused-significant")) {
    applyOverusedWordCap(
      next,
      "significant",
      OVERUSED_WORD_ALTERNATIVES.significant!,
      counts,
    );
  }
  if (opts.tier === "aggressive" && !disabled.has("overused-noteworthy")) {
    applyOverusedWordCap(
      next,
      "noteworthy",
      OVERUSED_WORD_ALTERNATIVES.noteworthy!,
      counts,
    );
  }
  if (opts.tier === "aggressive" && !disabled.has("overused-compelling")) {
    applyOverusedWordCap(
      next,
      "compelling",
      OVERUSED_WORD_ALTERNATIVES.compelling!,
      counts,
    );
  }

  industryNewsletterStructureSchema.parse(next);

  const reports: PolishReport[] = [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([ruleId, count]) => ({ ruleId, count }))
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));

  const rulesFired = Object.fromEntries(
    reports.map((report) => [report.ruleId, report.count]),
  );
  const totalReplacements = reports.reduce(
    (sum, report) => sum + report.count,
    0,
  );

  return {
    structure: next,
    reports,
    totalReplacements,
    rulesFired,
  };
};
