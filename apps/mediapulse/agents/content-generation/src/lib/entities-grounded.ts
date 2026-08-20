/**
 * Grounding for the named entities a summary point asserts, used only for sources that carry no
 * article body.
 *
 * A source whose body could not be fetched falls back to its collection-time description, which is
 * marketing copy written for search engines and carries no editorial guarantee. On 2026-08-20 a
 * Kompas article about the NTT earthquake named no mobile operator anywhere in its text, while its
 * meta description named three; the summarizer reported all three as fact in EXCL's lead item.
 *
 * The description cannot ground itself, so the article's own title is the reference: it is the one
 * claim the newsroom actually made about the story.
 */

/** Longest run of capitalised words treated as one name, so "Bank Central Asia" stays together. */
const PROPER_NOUN_PHRASE =
  /[\p{Lu}][\p{L}&.'’-]*(?:\s+[\p{Lu}][\p{L}&.'’-]*)*/gu;

/** A headline abbreviation such as `BI`, `OJK`, or `ESDM`. */
const ACRONYM = /^[\p{Lu}]{2,6}$/u;

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

const normalize = (value: string): string =>
  value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Initials of a multi-word name, so `Bank Indonesia` reduces to `bi`.
 *
 * @param phrase - Candidate name.
 * @returns The initials, or an empty string for a single-word name.
 */
const initialsOf = (phrase: string): string => {
  const words = phrase.split(/\s+/).filter((word) => word.length > 0);

  return words.length < 2
    ? ""
    : words.map((word) => word[0]?.toLocaleLowerCase() ?? "").join("");
};

/**
 * Names a text asserts, skipping the word that opens each sentence.
 *
 * - Important: the opening word is skipped deliberately. English capitalises it whatever it is, so
 *   reading it as a name would drop correct points that merely begin with an ordinary noun. That
 *   lets a name in first position escape the check, which is the cheaper error: these newsletters
 *   are thin already, and deleting a supported fact costs more than missing an unsupported one.
 *
 * @param text - Text to scan.
 * @returns Names in order of appearance, deduplicated.
 */
export const properNounPhrases = (text: string): string[] => {
  const found = new Set<string>();
  for (const sentence of text.split(SENTENCE_SPLIT)) {
    const trimmed = sentence.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const openingWord = trimmed.split(/\s+/)[0] ?? "";
    for (const match of trimmed.matchAll(PROPER_NOUN_PHRASE)) {
      const phrase = match[0].replace(/[.'’-]+$/u, "").trim();
      if (phrase.length === 0 || match.index === 0) {
        continue;
      }
      if (phrase === openingWord) {
        continue;
      }
      found.add(phrase);
    }
  }

  return [...found];
};

/** Longest run of capitalised words an abbreviation is allowed to stand for. */
const MAX_ACRONYM_WORDS = 4;

/** Shortest word that may carry a match, so "the" and "dan" cannot vouch for anything. */
const MIN_MATCHABLE_WORD = 4;

/**
 * Whether two words name the same thing across the summary's translation of the headline.
 *
 * Prefix matching rather than equality: a point writes "Indonesian" where an Indonesian headline
 * writes "Indonesia". Requiring exact equality dropped a correct point about Bank Indonesia's credit
 * card scheme because the English rendering of the product name shares no whole word with the
 * original.
 *
 * @param word - Word from the name the point asserts.
 * @param titleWord - Word from the article's title.
 */
const sameWord = (word: string, titleWord: string): boolean =>
  word.length >= MIN_MATCHABLE_WORD &&
  titleWord.length >= MIN_MATCHABLE_WORD &&
  (word.startsWith(titleWord) || titleWord.startsWith(word));

/**
 * Whether any run of capitalised words in the title reduces to the given abbreviation.
 *
 * Windows rather than whole phrases: a headline capitalises most of its words, so
 * "Bank Indonesia Tahan Suku Bunga Acuan" is one run whose initials spell nothing. `BI` has to be
 * matched against the leading pair inside it.
 *
 * @param acronym - Normalised abbreviation from the point, such as `bi`.
 * @param title - The article's own title.
 */
const titleExpandsAcronym = (acronym: string, title: string): boolean => {
  const capitalisedWords = title
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}]/gu, ""))
    .filter((word) => word.length > 0 && /^\p{Lu}/u.test(word));

  for (let start = 0; start < capitalisedWords.length; start += 1) {
    for (let size = 2; size <= MAX_ACRONYM_WORDS; size += 1) {
      const window = capitalisedWords.slice(start, start + size);
      if (window.length < size) {
        break;
      }
      if (initialsOf(window.join(" ")) === acronym) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Whether a title vouches for a name, allowing an abbreviation to stand for its expansion.
 *
 * A headline routinely writes `BI` where an English summary writes `Bank Indonesia`, and the two
 * name the same body. Matching runs both ways so either side may carry the short form.
 *
 * @param phrase - Name asserted by the point.
 * @param title - The article's own title.
 */
const titleVouchesFor = (phrase: string, title: string): boolean => {
  const normalizedTitle = normalize(title);
  const normalizedPhrase = normalize(phrase);
  if (normalizedPhrase.length === 0) {
    return true;
  }
  const titleWords = normalizedTitle.split(" ").filter(Boolean);
  if (
    titleWords.includes(normalizedPhrase) ||
    normalizedTitle.includes(normalizedPhrase)
  ) {
    return true;
  }

  const phraseInitials = initialsOf(phrase);
  if (phraseInitials.length >= 2 && titleWords.includes(phraseInitials)) {
    return true;
  }

  if (ACRONYM.test(phrase) && titleExpandsAcronym(normalizedPhrase, title)) {
    return true;
  }

  return normalizedPhrase
    .split(" ")
    .some((word) => titleWords.some((titleWord) => sameWord(word, titleWord)));
};

/**
 * Names a point asserts that its article's title does not vouch for.
 *
 * - Important: for a source carrying only its collection-time description there is no article text
 *   to ground against, and the description is not evidence of what the article reports. Callers use
 *   this only in that case; a source with a fetched body grounds against the body instead.
 *
 * @param point - One summary point.
 * @param title - The article's own title.
 * @returns The unvouched names, empty when the point asserts none.
 */
export const ungroundedEntities = (point: string, title: string): string[] =>
  properNounPhrases(point).filter((phrase) => !titleVouchesFor(phrase, title));
