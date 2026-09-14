const META_PATTERNS: readonly RegExp[] = [
  /\b(?:the|this)\s+(?:article|report|piece|story|text)\b/iu,
  /\b(?:is|are|was|were)\s+not\s+(?:mentioned|named|discussed|covered|referenced|cited)\b/iu,
  /\b(?:does|do|did)\s+not\s+(?:mention|name|discuss|cover|reference|cite)\b/iu,
  /\bno\s+mention\s+(?:of|is\s+made)\b/iu,
  /\bmakes?\s+no\s+mention\b/iu,
  /\b(?:is|are)\s+absent\s+from\b/iu,
  /\b(?:is|are)\s+(?:only\s+)?(?:named|mentioned|referenced|cited|listed)\s+(?:only\s+)?(?:by\s+name|in\s+passing)\b/iu,
];

export const isMetaPoint = (point: string): boolean =>
  META_PATTERNS.some((pattern) => pattern.test(point));
