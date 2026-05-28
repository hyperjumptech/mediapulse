/** Keep in sync with `INDUSTRY_NEWSLETTER_WIRE_MARKER` in content-generation `format-industry-newsletter.ts`. */
export const INDUSTRY_NEWSLETTER_WIRE_MARKER = "MP_NEWSLETTER";

const READ_FULL_ARTICLE_LABEL = "Read the full article";

const READ_FULL_ARTICLE_LINE_REGEX = new RegExp(
  String.raw`(?:^|\n)\s*` + READ_FULL_ARTICLE_LABEL + String.raw`:\s*(\S+)\s*$`,
  "i",
);

/** Parsed industry-pulse block. */
export type ParsedIndustryPulseSection = {
  machineKey: "industry-pulse";
  displayHeading: string;
  prose: string;
};

/** Parsed bullet list section (competitive, deals, regulatory, disruptors bullets). */
export type ParsedIndustryBulletSection = {
  machineKey:
    | "competitive-landscape"
    | "deals-and-movements"
    | "regulatory-policy-watch"
    | "disruptors-or-tech";
  displayHeading: string;
  bullets: Array<{ text: string; url?: string }>;
};

/** Parsed disruptors-or-tech prose variant. */
export type ParsedIndustryDisruptorsProseSection = {
  machineKey: "disruptors-or-tech";
  displayHeading: string;
  format: "prose";
  prose: string;
};

export type ParsedIndustryQuickHitsSection = {
  machineKey: "quick-hits";
  displayHeading: string;
  items: Array<{ text: string; url?: string }>;
};

export type ParsedIndustrySection =
  | ParsedIndustryPulseSection
  | ParsedIndustryBulletSection
  | ParsedIndustryDisruptorsProseSection
  | ParsedIndustryQuickHitsSection;

export type IndustryParsedNewsletterBody = {
  format: "industry";
  sections: ParsedIndustrySection[];
};

/**
 * Splits trailing `Read the full article: <url>` from a text block.
 *
 * @param block - Raw block text.
 * @returns Prose without the trailing URL line when present.
 */
const splitTrailingReadLine = (
  block: string,
): { text: string; url?: string } => {
  const trimmed = block.trim();
  const match = READ_FULL_ARTICLE_LINE_REGEX.exec(trimmed);
  if (match === null) {
    return { text: trimmed };
  }
  const urlCandidate = match[1]?.trim() ?? "";
  const text = trimmed.slice(0, match.index).trim();
  if (urlCandidate.length === 0) {
    return { text };
  }
  return { text, url: urlCandidate };
};

const isBlank = (line: string): boolean => line.trim().length === 0;

/**
 * Parses the industry newsletter wire body (marker + BEGIN/END blocks).
 *
 * @param bodyText - Full newsletter body string.
 * @returns Parsed sections, or `undefined` when the marker is present but the body is invalid.
 */
export const parseIndustryNewsletterWire = (
  bodyText: string,
): IndustryParsedNewsletterBody | undefined => {
  const trimmed = bodyText.trim();
  const lines = trimmed.split("\n");
  if (
    lines.length === 0 ||
    lines[0]?.trim() !== INDUSTRY_NEWSLETTER_WIRE_MARKER
  ) {
    return undefined;
  }

  const sections: ParsedIndustrySection[] = [];
  let i = 1;

  const skipBlanks = (): void => {
    while (i < lines.length && isBlank(lines[i] ?? "")) {
      i += 1;
    }
  };

  const readUntilToken = (stopTokens: Set<string>): string => {
    const acc: string[] = [];
    while (i < lines.length) {
      const raw = lines[i] ?? "";
      const t = raw.trim();
      if (stopTokens.has(t)) {
        break;
      }
      acc.push(raw);
      i += 1;
    }
    return acc.join("\n").trim();
  };

  skipBlanks();
  while (i < lines.length) {
    skipBlanks();
    const line = lines[i]?.trim() ?? "";
    if (line.length === 0) {
      break;
    }
    if (!line.startsWith("BEGIN ")) {
      return undefined;
    }
    const machineKey = line.slice("BEGIN ".length).trim();
    i += 1;
    skipBlanks();
    if ((lines[i] ?? "").trim() !== "DISPLAY_HEADING") {
      return undefined;
    }
    i += 1;
    const displayHeading = (lines[i] ?? "").trim();
    if (displayHeading.length === 0) {
      return undefined;
    }
    i += 1;

    if (machineKey === "industry-pulse") {
      if ((lines[i] ?? "").trim() !== "PROSE") {
        return undefined;
      }
      i += 1;
      const prose = readUntilToken(new Set(["END"]));
      if ((lines[i] ?? "").trim() !== "END") {
        return undefined;
      }
      i += 1;
      sections.push({
        machineKey: "industry-pulse",
        displayHeading,
        prose,
      });
      continue;
    }

    if (
      machineKey === "competitive-landscape" ||
      machineKey === "deals-and-movements" ||
      machineKey === "regulatory-policy-watch"
    ) {
      const bullets: Array<{ text: string; url?: string }> = [];
      while (i < lines.length && (lines[i] ?? "").trim() === "BULLET") {
        i += 1;
        const body = readUntilToken(new Set(["BULLET", "END"]));
        bullets.push(splitTrailingReadLine(body));
      }
      if ((lines[i] ?? "").trim() !== "END") {
        return undefined;
      }
      i += 1;
      sections.push({
        machineKey,
        displayHeading,
        bullets,
      });
      continue;
    }

    if (machineKey === "disruptors-or-tech") {
      if ((lines[i] ?? "").trim() !== "FORMAT") {
        return undefined;
      }
      i += 1;
      const fmt = (lines[i] ?? "").trim();
      i += 1;
      if (fmt === "prose") {
        if ((lines[i] ?? "").trim() !== "PROSE") {
          return undefined;
        }
        i += 1;
        const prose = readUntilToken(new Set(["END"]));
        if ((lines[i] ?? "").trim() !== "END") {
          return undefined;
        }
        i += 1;
        sections.push({
          machineKey: "disruptors-or-tech",
          displayHeading,
          format: "prose",
          prose,
        });
        continue;
      }
      if (fmt === "bullets") {
        const bullets: Array<{ text: string; url?: string }> = [];
        while (i < lines.length && (lines[i] ?? "").trim() === "BULLET") {
          i += 1;
          const body = readUntilToken(new Set(["BULLET", "END"]));
          bullets.push(splitTrailingReadLine(body));
        }
        if ((lines[i] ?? "").trim() !== "END") {
          return undefined;
        }
        i += 1;
        sections.push({
          machineKey: "disruptors-or-tech",
          displayHeading,
          bullets,
        });
        continue;
      }
      return undefined;
    }

    if (machineKey === "quick-hits") {
      const items: Array<{ text: string; url?: string }> = [];
      while (i < lines.length && (lines[i] ?? "").trim() === "ITEM") {
        i += 1;
        const body = readUntilToken(new Set(["ITEM", "END"]));
        items.push(splitTrailingReadLine(body));
      }
      if ((lines[i] ?? "").trim() !== "END") {
        return undefined;
      }
      i += 1;
      sections.push({
        machineKey: "quick-hits",
        displayHeading,
        items,
      });
      continue;
    }

    return undefined;
  }

  return { format: "industry", sections };
};
