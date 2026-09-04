/**
 * Article classes that name the right company and still carry no news.
 *
 * The issuer-relevance gate asks whether an article concerns the issuer or its market, and a
 * recruitment advert for a competitor answers yes. On 2026-09-04 an ANTM issue spent three of its
 * seven slots on a PT Vale job advert, a mining journalism competition, and a village fire-safety
 * briefing, all of which cleared the gate on the strength of naming Vale or the mining sector.
 */
export type NonNewsClass =
  | "recruitment"
  | "competition_call"
  | "community_activity";

const PATTERNS: { kind: NonNewsClass; pattern: RegExp }[] = [
  {
    kind: "recruitment",
    pattern:
      /\b(?:lowongan\s+(?:kerja|pekerjaan)|buka\s+lowongan|rekrutmen|penerimaan\s+(?:pegawai|karyawan)|management\s+trainee|management\s+development\s+program|job\s+vacanc(?:y|ies)|now\s+hiring|we\s+are\s+hiring|career\s+opportunit(?:y|ies))\b/iu,
  },
  {
    kind: "competition_call",
    pattern:
      /\b(?:lomba\s+\p{L}+|sayembara|kompetisi\s+(?:menulis|jurnalistik|foto|karya)|anugerah\s+jurnalistik|journalism\s+(?:competition|award)|writing\s+competition|call\s+for\s+(?:entries|papers|submissions))\b/iu,
  },
  {
    kind: "community_activity",
    pattern:
      /\b(?:sosialisasi|bakti\s+sosial|baksos|penghijauan|khitanan\s+massal|santunan|donasi\s+\p{L}+|community\s+outreach)\b/iu,
  },
];

/**
 * Facts that make an article news whatever else it is about. A recruitment drive reported alongside
 * a headcount target or an investment figure is a business story; one reported alongside an
 * application deadline is an advertisement.
 */
const NEWS_SIGNAL =
  /(?:\b(?:rp|idr|usd|us\$|\$)\s?\d|\d+(?:[.,]\d+)?\s*(?:%|persen|percent)|\b\d+(?:[.,]\d+)?\s*(?:triliun|trillion|miliar|billion|juta|million)\b|\b(?:laba|profit|revenue|pendapatan|dividen|dividend|akuisisi|acquisition|merger|produksi|production|kapasitas|capacity)\b)/iu;

/**
 * Reports the non-news class an article belongs to, when it belongs to one.
 *
 * - Important: the check runs on the title alone. A body mentioning a job opening in passing does
 *   not make the article an advert, whereas a headline announcing one is the whole story.
 *
 * @param title - The article's title.
 * @param content - The article's body, used only to look for a fact that redeems it.
 * @returns The class, or `null` when the article is ordinary news.
 */
export const nonNewsContentClass = (
  title: string,
  content: string,
): NonNewsClass | null => {
  const match = PATTERNS.find((entry) => entry.pattern.test(title));
  if (match === undefined) {
    return null;
  }
  if (NEWS_SIGNAL.test(title) || NEWS_SIGNAL.test(content)) {
    return null;
  }

  return match.kind;
};
