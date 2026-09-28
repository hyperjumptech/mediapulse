export const formatJsonBlockValue = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    const serialized = JSON.stringify(value, null, 2);

    return serialized ?? String(value);
  } catch {
    return String(value);
  }
};
