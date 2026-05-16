import { READ_FULL_ARTICLE_LABEL } from "./format-newsletter-content.js";
import type { IndustryNewsletterResolved } from "./industry-newsletter-urls.js";

/**
 * First line marker for Mediapulse industry newsletter wire format v2.
 *
 * Keep in sync with `INDUSTRY_NEWSLETTER_WIRE_V2_MARKER` in
 * `packages/shared/email-templates/src/newsletter/parse-newsletter-body.ts`.
 */
export const INDUSTRY_NEWSLETTER_WIRE_V2_MARKER = "MP_NEWSLETTER_V2";

const BEGIN = "BEGIN";
const END = "END";
const DISPLAY_HEADING = "DISPLAY_HEADING";
const PROSE = "PROSE";
const FORMAT = "FORMAT";
const BULLET = "BULLET";
const ITEM = "ITEM";
const SUMMARY = "SUMMARY";
const QUOTE = "QUOTE";
const ATTRIBUTION = "ATTRIBUTION";

/**
 * Collapses internal whitespace so display headings stay a single wire line.
 *
 * @param value - Raw heading text.
 * @returns Single-line heading.
 */
const collapseHeadingLine = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

/**
 * Appends the deterministic `Read the full article: <url>` line when a URL exists.
 *
 * @param text - Body text without a trailing source line.
 * @param url - Optional URL from Hermes sources.
 * @returns Combined text for the wire block body.
 */
const withOptionalReadLine = (text: string, url?: string): string => {
  const trimmedUrl = url?.trim() ?? "";
  if (trimmedUrl.length === 0) {
    return text.trimEnd();
  }
  return `${text.trimEnd()}\n${READ_FULL_ARTICLE_LABEL}: ${trimmedUrl}`;
};

/**
 * Serializes a resolved industry briefing into the v2 plain-text wire format.
 *
 * @param briefing - Ground-truth briefing with URLs attached from sources.
 * @returns Wire body whose first line is {@link INDUSTRY_NEWSLETTER_WIRE_V2_MARKER}.
 */
export const formatIndustryNewsletterV2Wire = (
  briefing: IndustryNewsletterResolved,
): string => {
  const parts: string[] = [INDUSTRY_NEWSLETTER_WIRE_V2_MARKER, ""];

  const pushBlock = (block: string): void => {
    parts.push(block.trimEnd(), "");
  };

  pushBlock(
    [
      `${BEGIN} industry-pulse`,
      DISPLAY_HEADING,
      collapseHeadingLine(briefing.industryPulse.displayHeading),
      PROSE,
      briefing.industryPulse.prose.trim(),
      END,
    ].join("\n"),
  );

  const pushBulletSection = (
    machineKey: string,
    displayHeading: string,
    bullets: ReadonlyArray<{ text: string; url?: string }>,
  ): void => {
    const lines: string[] = [
      `${BEGIN} ${machineKey}`,
      DISPLAY_HEADING,
      collapseHeadingLine(displayHeading),
    ];
    for (const b of bullets) {
      lines.push(BULLET, withOptionalReadLine(b.text, b.url));
    }
    lines.push(END);
    pushBlock(lines.join("\n"));
  };

  pushBulletSection(
    "competitive-landscape",
    briefing.competitiveLandscape.displayHeading,
    briefing.competitiveLandscape.bullets,
  );
  pushBulletSection(
    "deals-and-movements",
    briefing.dealsAndMovements.displayHeading,
    briefing.dealsAndMovements.bullets,
  );
  pushBulletSection(
    "regulatory-policy-watch",
    briefing.regulatoryPolicyWatch.displayHeading,
    briefing.regulatoryPolicyWatch.bullets,
  );

  const d = briefing.disruptorsOrTech;
  if (d.format === "prose") {
    pushBlock(
      [
        `${BEGIN} disruptors-or-tech`,
        DISPLAY_HEADING,
        collapseHeadingLine(d.displayHeading),
        FORMAT,
        "prose",
        PROSE,
        d.prose.trim(),
        END,
      ].join("\n"),
    );
  } else {
    const lines: string[] = [
      `${BEGIN} disruptors-or-tech`,
      DISPLAY_HEADING,
      collapseHeadingLine(d.displayHeading),
      FORMAT,
      "bullets",
    ];
    for (const b of d.bullets) {
      lines.push(BULLET, withOptionalReadLine(b.text, b.url));
    }
    lines.push(END);
    pushBlock(lines.join("\n"));
  }

  const qhLines: string[] = [
    `${BEGIN} quick-hits`,
    DISPLAY_HEADING,
    collapseHeadingLine(briefing.quickHits.displayHeading),
  ];
  for (const item of briefing.quickHits.items) {
    qhLines.push(ITEM, withOptionalReadLine(item.text, item.url));
  }
  qhLines.push(END);
  pushBlock(qhLines.join("\n"));

  if (briefing.readWatchListen) {
    const rw = briefing.readWatchListen;
    pushBlock(
      [
        `${BEGIN} read-watch-listen`,
        DISPLAY_HEADING,
        collapseHeadingLine(rw.displayHeading),
        SUMMARY,
        withOptionalReadLine(rw.summary, rw.url),
        END,
      ].join("\n"),
    );
  }

  if (briefing.quoteOfTheWeek) {
    const q = briefing.quoteOfTheWeek;
    const quoteLines = [
      `${BEGIN} quote-of-the-week`,
      DISPLAY_HEADING,
      collapseHeadingLine(q.displayHeading),
      QUOTE,
      q.quote.trim(),
      ATTRIBUTION,
      q.attribution.trim(),
    ];
    const trimmedUrl = q.url?.trim() ?? "";
    if (trimmedUrl.length > 0) {
      quoteLines.push(`${READ_FULL_ARTICLE_LABEL}: ${trimmedUrl}`);
    }
    quoteLines.push(END);
    pushBlock(quoteLines.join("\n"));
  }

  return parts.join("\n").trimEnd() + "\n";
};
