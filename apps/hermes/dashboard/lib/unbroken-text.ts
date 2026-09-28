const WHITESPACE_PATTERN = /\s/;

export const isUnbrokenText = (text: string): boolean =>
  text.length > 0 && !WHITESPACE_PATTERN.test(text);
