const flatten = (value: string): string =>
  value.replace(/\s+/gu, " ").trim().toLowerCase();

export const spanIsInText = (text: string, span: string): boolean => {
  const needle = flatten(span);

  return needle.length > 0 && flatten(text).includes(needle);
};
