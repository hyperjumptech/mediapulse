const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    const sorted = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => [key, canonicalize(entry)] as const);

    return Object.fromEntries(sorted);
  }

  return value;
};

export const pairingKey = (input: Record<string, unknown>): string =>
  JSON.stringify(canonicalize(input));

export const buildPairingIndex = (
  inputs: Record<string, unknown>[],
  startIndex: number,
): Map<string, number | null> => {
  const index = new Map<string, number | null>();
  for (const [offset, input] of inputs.entries()) {
    const key = pairingKey(input);
    index.set(key, index.has(key) ? null : startIndex + offset);
  }

  return index;
};

export const resolvePairedDependencies = (
  input: Record<string, unknown>,
  pairingIndex: Map<string, number | null>,
  previousWaveIndices: number[],
): number[] => {
  const paired = pairingIndex.get(pairingKey(input));

  return typeof paired === "number" ? [paired] : [...previousWaveIndices];
};
