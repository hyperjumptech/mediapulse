export type ProfileParty = {
  name: string;
  aliases: string[];
  ambiguousNames?: string[];
};

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export const parseProfileParties = (value: unknown): ProfileParty[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const parties: ProfileParty[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    const candidate = entry as {
      name?: unknown;
      aliases?: unknown;
      ambiguousNames?: unknown;
    };
    if (typeof candidate.name !== "string" || candidate.name.trim() === "") {
      continue;
    }
    const ambiguousNames = stringsOf(candidate.ambiguousNames);
    parties.push({
      name: candidate.name,
      aliases: stringsOf(candidate.aliases),
      ...(ambiguousNames.length > 0 ? { ambiguousNames } : {}),
    });
  }

  return parties;
};
