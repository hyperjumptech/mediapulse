const LEADING_DECORATION_PATTERN =
  /^(?:[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}\u{2022}\u{25A0}-\u{25FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]|\s)+/u;

const TRAILING_DECORATION_PATTERN =
  /(?:[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}\u{2022}\u{25A0}-\u{25FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]|\s)+$/u;

export const sanitizeArticleTitle = (title: string): string => {
  const stripped = title
    .replace(LEADING_DECORATION_PATTERN, "")
    .replace(TRAILING_DECORATION_PATTERN, "");

  return stripped.length > 0 ? stripped : title.trim();
};
