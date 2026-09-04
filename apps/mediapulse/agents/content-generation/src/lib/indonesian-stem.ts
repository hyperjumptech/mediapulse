/**
 * Indonesian derivational prefixes, longest first so `meng` is tried before `me`.
 *
 * Only the forms that change a headline's wording without changing its subject are listed. A
 * headline saying `dilarang` and another saying `larang` are the same verb, and dedup compares them
 * as different anchors without this.
 */
const PREFIXES = [
  "menge",
  "meng",
  "meny",
  "mem",
  "men",
  "per",
  "ter",
  "ber",
  "di",
  "ke",
  "me",
  "pe",
  "se",
] as const;

/** Indonesian derivational suffixes, longest first. */
const SUFFIXES = ["kannya", "annya", "kan", "nya", "an", "i"] as const;

/**
 * Shortest acceptable stem. Below this an affix strip is more likely to be a coincidence than a
 * derivation: `sisa` must not become `sis`, and `kita` must not become `kit`.
 */
const MIN_STEM_LENGTH = 4;

/**
 * Reduces an Indonesian word to a stem two spellings of it can share.
 *
 * At most one prefix and one suffix are removed, and each only when what remains is still a
 * plausible word. This is deliberately shallow: the goal is that `dilarang` and `larang`, or
 * `hanguskan` and `hangus`, land on one token, not that the result is a dictionary root.
 *
 * - Important: applied to both sides of a comparison, so an over-strip that is wrong in isolation
 *   is still consistent. It costs precision only when two genuinely different words collapse.
 *
 * @param token - One lowercase token.
 * @returns The token with at most one prefix and one suffix removed.
 */
export const stemIndonesian = (token: string): string => {
  let stem = token;
  for (const prefix of PREFIXES) {
    if (
      stem.startsWith(prefix) &&
      stem.length - prefix.length >= MIN_STEM_LENGTH
    ) {
      stem = stem.slice(prefix.length);
      break;
    }
  }
  for (const suffix of SUFFIXES) {
    if (
      stem.endsWith(suffix) &&
      stem.length - suffix.length >= MIN_STEM_LENGTH
    ) {
      stem = stem.slice(0, -suffix.length);
      break;
    }
  }

  return stem;
};

/**
 * Words that name no particular story.
 *
 * Two headlines sharing only "credit", "grew", "became" and "trillion" are two financial stories,
 * not one event. Stemming raises recall and brings this collision with it: without the check,
 * "Ekspansi Kredit ... Laba BRI Tumbuh 17,5 Persen Jadi Rp31,2 Triliun" and
 * "Kredit UMKM BRI Tumbuh 8,6% menjadi Rp1.235,4 Triliun" merge on those four words alone.
 *
 * Stored stemmed, because that is the form a comparison sees: `persen` reaches the check as `rsen`.
 */
const GENERIC_EVENT_WORDS = [
  "bank",
  "bawa",
  "bisnis",
  "business",
  "credit",
  "dana",
  "ekonomi",
  "economy",
  "growth",
  "harga",
  "indonesia",
  "industri",
  "industry",
  "jadi",
  "juta",
  "kredit",
  "kuartal",
  "laba",
  "market",
  "menjadi",
  "miliar",
  "million",
  "naik",
  "nasional",
  "national",
  "pasar",
  "percent",
  "persen",
  "perusahaan",
  "price",
  "profit",
  "quarter",
  "saham",
  "sector",
  "sektor",
  "semester",
  "share",
  "tahun",
  "triliun",
  "trillion",
  "tumbuh",
  "year",
] as const;

/**
 * Both spellings of each word: headline anchors reach the check stemmed, body anchors do not.
 */
const GENERIC_EVENT_STEMS: ReadonlySet<string> = new Set(
  GENERIC_EVENT_WORDS.flatMap((word) => [word, stemIndonesian(word)]),
);

/**
 * A bare year. Two reports of one reporting period share it without being one story, so it names a
 * period rather than an event.
 */
const CALENDAR_YEAR = /^(?:19|20)\d{2}$/u;

/**
 * Whether shared anchors name a particular event rather than a shared subject area.
 *
 * - Important: this gates the merge decision, not the anchor set. A generic stem still counts toward
 *   the shared total and the containment ratio; what it cannot do is be the only evidence.
 *
 * @param shared - Stems present in both anchor sets.
 * @returns True when at least one shared stem identifies the story.
 */
export const sharesDistinctiveAnchor = (shared: Iterable<string>): boolean => {
  for (const stem of shared) {
    if (!GENERIC_EVENT_STEMS.has(stem) && !CALENDAR_YEAR.test(stem)) {
      return true;
    }
  }

  return false;
};
