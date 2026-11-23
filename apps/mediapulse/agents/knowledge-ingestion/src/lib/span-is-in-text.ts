const CLOSING_PUNCTUATION = /[\s.,;:!?…"'“”‘’«»)\]]+$/u;

const flatten = (value: string): string =>
  value.replace(/\s+/gu, " ").trim().toLowerCase();

export const spanIsInText = (text: string, span: string): boolean => {
  const needle = flatten(span).replace(CLOSING_PUNCTUATION, "");

  return needle.length > 0 && flatten(text).includes(needle);
};
