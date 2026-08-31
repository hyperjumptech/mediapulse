const SCALE_WORDS =
  "triliun|trilyun|trillion|miliar|milyar|billion|juta|million|ribu|thousand|bn|mn";

const CURRENCY_MARKERS = "rp|idr|usd|us\\$|\\$|eur|€|sgd|myr|jpy|¥|£|gbp";

const NUMBER = "\\d[\\d.,]*";

const FIGURE_PATTERNS: { kind: FigureKind; pattern: RegExp }[] = [
  {
    kind: "percent",
    pattern: new RegExp(`(${NUMBER})\\s*(?:%|persen|percent|pct)\\b`, "gi"),
  },
  {
    kind: "currency",
    pattern: new RegExp(
      `(?:${CURRENCY_MARKERS})\\s*(${NUMBER})(?:\\s*(?:${SCALE_WORDS}))?`,
      "gi",
    ),
  },
  {
    kind: "scaled",
    pattern: new RegExp(`(${NUMBER})\\s*(?:${SCALE_WORDS})\\b`, "gi"),
  },
];

const RESULT_TERMS = [
  "pendapatan",
  "penjualan",
  "laba",
  "rugi",
  "margin",
  "ebitda",
  "dividen",
  "aset",
  "liabilitas",
  "ekuitas",
  "kontrak",
  "akuisisi",
  "capex",
  "belanja modal",
  "investasi",
  "produksi",
  "kapasitas",
  "pelanggan",
  "target",
  "proyeksi",
  "revenue",
  "sales",
  "profit",
  "net income",
  "earnings",
  "dividend",
  "capacity",
  "output",
  "guidance",
];

const AMBIENT_TERMS = [
  "ihsg",
  "indeks harga saham",
  "jakarta composite",
  "bursa mencatat",
  "pasar modal indonesia",
  "produk domestik bruto",
  "pdb",
  "inflasi",
  "suku bunga acuan",
  "kurs rupiah",
];

export type FigureKind = "percent" | "currency" | "scaled";

export type MaterialFigure = {
  kind: FigureKind;
  raw: string;
  digits: string;
  sentence: string;
};

export const normalizeDigits = (raw: string): string =>
  raw.replace(/[.,\s]/g, "").replace(/^0+(?=\d)/, "");

const splitSentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

const containsAny = (haystack: string, needles: string[]): boolean =>
  needles.some((needle) => haystack.includes(needle));

const issuerMentioned = (text: string, aliases: string[]): boolean =>
  aliases.some(
    (alias) => alias.length > 2 && text.includes(alias.toLowerCase()),
  );

export const articleIsAboutIssuer = (
  title: string,
  content: string,
  aliases: string[],
): boolean => {
  const lowerAliases = aliases.map((alias) => alias.toLowerCase());
  if (issuerMentioned(title.toLowerCase(), lowerAliases)) {
    return true;
  }
  const opening = splitSentences(content).slice(0, 3).join(" ").toLowerCase();

  return issuerMentioned(opening, lowerAliases);
};

export const extractMaterialFigures = (
  title: string,
  content: string,
  aliases: string[],
): MaterialFigure[] => {
  if (!articleIsAboutIssuer(title, content, aliases)) {
    return [];
  }
  const seen = new Set<string>();
  const figures: MaterialFigure[] = [];

  for (const sentence of splitSentences(content)) {
    const lowered = sentence.toLowerCase();
    if (containsAny(lowered, AMBIENT_TERMS)) {
      continue;
    }
    if (!containsAny(lowered, RESULT_TERMS)) {
      continue;
    }

    for (const { kind, pattern } of FIGURE_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of sentence.matchAll(pattern)) {
        const digits = normalizeDigits(match[1] ?? "");
        if (digits.length === 0 || seen.has(digits)) {
          continue;
        }
        seen.add(digits);
        figures.push({ kind, raw: match[0].trim(), digits, sentence });
      }
    }
  }

  return figures;
};

export const figuresInText = (text: string): Set<string> => {
  const found = new Set<string>();
  for (const { pattern } of FIGURE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const digits = normalizeDigits(match[1] ?? "");
      if (digits.length > 0) {
        found.add(digits);
      }
    }
  }

  return found;
};
