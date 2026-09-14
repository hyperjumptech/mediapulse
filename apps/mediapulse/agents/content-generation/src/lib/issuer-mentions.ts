const MIN_SINGLE_WORD_NAME = 3;

const escapeForPattern = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const isAllUppercase = (value: string): boolean =>
  /\p{Lu}/u.test(value) && value === value.toLocaleUpperCase();

const patternFor = (name: string): RegExp | undefined => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return undefined;
  }
  const body = words.map(escapeForPattern).join("\\s+");
  const caseSensitive = words.length === 1 && isAllUppercase(name);

  return new RegExp(
    `(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`,
    caseSensitive ? "u" : "iu",
  );
};

export type IssuerIdentityInput = {
  name?: string | undefined;
  symbol?: string | undefined;
  aliases?: readonly string[] | undefined;
};

export const issuerNamesFrom = (identity: IssuerIdentityInput): string[] => {
  const seen = new Set<string>();
  const names: string[] = [];
  const candidates = [
    identity.symbol,
    identity.name,
    ...(identity.aliases ?? []),
  ];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim() ?? "";
    if (trimmed.length === 0) {
      continue;
    }
    const isSingleWord = !/\s/u.test(trimmed);
    if (isSingleWord && trimmed.length < MIN_SINGLE_WORD_NAME) {
      continue;
    }
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    names.push(trimmed);
  }

  return names;
};

export const issuerMentions = (
  text: string,
  names: readonly string[],
): string[] => {
  const found: string[] = [];
  for (const name of names) {
    const pattern = patternFor(name);
    if (pattern !== undefined && pattern.test(text)) {
      found.push(name);
    }
  }

  return found;
};

export const mentionsIssuer = (
  text: string,
  names: readonly string[],
): boolean => issuerMentions(text, names).length > 0;
