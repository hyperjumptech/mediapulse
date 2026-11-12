const COUNT_WORDS = [
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

const BARE_COUNT_LEAD_PATTERN = new RegExp(
  `^\\s*the\\s+(?:\\d+|${COUNT_WORDS.join("|")})\\s*:`,
  "iu",
);

export const opensWithBareCount = (point: string): boolean =>
  BARE_COUNT_LEAD_PATTERN.test(point);
