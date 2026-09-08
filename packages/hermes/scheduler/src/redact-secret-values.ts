export const REDACTED_PLACEHOLDER = "[redacted]";

const redactString = (
  value: string,
  secretValues: readonly string[],
): string => {
  let redacted = value;
  for (const secret of secretValues) {
    if (redacted.includes(secret)) {
      redacted = redacted.split(secret).join(REDACTED_PLACEHOLDER);
    }
  }

  return redacted;
};

export const collectSecretValues = (
  values: Iterable<string>,
): readonly string[] =>
  Array.from(new Set(values))
    .filter((value) => value.trim() !== "")
    .sort((left, right) => right.length - left.length);

export const redactSecretValues = <T>(
  value: T,
  secretValues: readonly string[],
): T => {
  if (secretValues.length === 0) {
    return value;
  }

  if (typeof value === "string") {
    return redactString(value, secretValues) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      redactSecretValues(entry, secretValues),
    ) as unknown as T;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, entry]) => [key, redactSecretValues(entry, secretValues)] as const,
    );

    return Object.fromEntries(entries) as T;
  }

  return value;
};
