import { READ_FULL_ARTICLE_LABEL } from "./format-newsletter-content.js";
import type { IndustryNewsletterResolved } from "./industry-newsletter-urls.js";

/**
 * First line marker for Mediapulse industry newsletter wire format.
 *
 * Keep in sync with `INDUSTRY_NEWSLETTER_WIRE_MARKER` in
 * `packages/shared/email-templates/src/newsletter/parse-industry-newsletter-wire.ts`.
 * Section presence in the wire is variable — only sections present on the resolved briefing
 * with at least one row are emitted. Do not assume all six sections always appear.
 */
export const INDUSTRY_NEWSLETTER_WIRE_MARKER = "MP_NEWSLETTER";

const BEGIN = "BEGIN";
const END = "END";
const DISPLAY_HEADING = "DISPLAY_HEADING";
const PROSE = "PROSE";
const FORMAT = "FORMAT";
const BULLET = "BULLET";
const ITEM = "ITEM";
const TITLE = "TITLE";
const AUTHOR = "AUTHOR";
const SOURCE = "SOURCE";

/**
 * Collapses internal whitespace so display headings stay a single wire line.
 *
 * @param value - Raw heading text.
 * @returns Single-line heading.
 */
const collapseHeadingLine = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

/**
 * Removes inline "(Article N)" citation markers from reader-facing text.
 *
 * @param text - Raw bullet, quick-hit, or prose string from the LLM.
 * @returns Text with article markers stripped; unchanged when none are present.
 */
export const stripArticleMarkers = (text: string): string =>
  text.replace(/\s*\([^()]*\bArticles?\s+\d+[^()]*\)/gi, "");

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

const hasRows = (section: { bullets: ReadonlyArray<unknown> }): boolean =>
  section.bullets.length > 0;

const pushBylineLines = (
  lines: string[],
  byline: { author?: string; source?: string },
): void => {
  if (byline.author !== undefined && byline.author.trim().length > 0) {
    lines.push(`${AUTHOR} ${collapseHeadingLine(byline.author)}`);
  }
  if (byline.source !== undefined && byline.source.trim().length > 0) {
    lines.push(`${SOURCE} ${collapseHeadingLine(byline.source)}`);
  }
};

/**
 * Serializes a resolved industry briefing into the plain-text wire format.
 *
 * Only sections that are present on the briefing AND have at least one row are emitted.
 * Section order is always: competitive-landscape → deals-and-movements →
 * regulatory-policy-watch → disruptors-or-tech → quick-hits. Omitting a middle section
 * never reorders the survivors.
 *
 * @param briefing - Ground-truth briefing with URLs attached from sources.
 * @returns Wire body whose first line is {@link INDUSTRY_NEWSLETTER_WIRE_MARKER}.
 */
export const formatIndustryNewsletterWire = (
  briefing: IndustryNewsletterResolved,
): string => {
  const parts: string[] = [INDUSTRY_NEWSLETTER_WIRE_MARKER, ""];

  const pushBlock = (block: string): void => {
    parts.push(block.trimEnd(), "");
  };

  if (briefing.industryPulse !== undefined) {
    const pulseLines: string[] = [
      `${BEGIN} industry-pulse`,
      DISPLAY_HEADING,
      collapseHeadingLine(briefing.industryPulse.displayHeading),
    ];
    if (
      briefing.industryPulse.title !== undefined &&
      briefing.industryPulse.title.trim().length > 0
    ) {
      pulseLines.push(
        `${TITLE} ${collapseHeadingLine(briefing.industryPulse.title)}`,
      );
    }
    pushBylineLines(pulseLines, briefing.industryPulse);
    pulseLines.push(
      PROSE,
      withOptionalReadLine(
        stripArticleMarkers(briefing.industryPulse.prose.trim()),
        briefing.industryPulse.url,
      ),
      END,
    );
    pushBlock(pulseLines.join("\n"));
  }

  const pushBulletSection = (
    machineKey: string,
    displayHeading: string,
    bullets: ReadonlyArray<{
      title?: string;
      text: string;
      url?: string;
      author?: string;
      source?: string;
    }>,
  ): void => {
    const lines: string[] = [
      `${BEGIN} ${machineKey}`,
      DISPLAY_HEADING,
      collapseHeadingLine(displayHeading),
    ];
    for (const b of bullets) {
      lines.push(BULLET);
      if (b.title !== undefined && b.title.trim().length > 0) {
        lines.push(`${TITLE} ${collapseHeadingLine(b.title)}`);
      }
      pushBylineLines(lines, b);
      lines.push(withOptionalReadLine(stripArticleMarkers(b.text), b.url));
    }
    lines.push(END);
    pushBlock(lines.join("\n"));
  };

  // Body sections are emitted in a fixed order so omitting a middle section never
  // reorders the survivors. Each emitter is a no-op when the section is absent or
  // has no rows.
  const bodyEmitters: Array<() => void> = [
    () => {
      if (
        briefing.competitiveLandscape !== undefined &&
        hasRows(briefing.competitiveLandscape)
      ) {
        pushBulletSection(
          "competitive-landscape",
          briefing.competitiveLandscape.displayHeading,
          briefing.competitiveLandscape.bullets,
        );
      }
    },
    () => {
      if (
        briefing.dealsAndMovements !== undefined &&
        hasRows(briefing.dealsAndMovements)
      ) {
        pushBulletSection(
          "deals-and-movements",
          briefing.dealsAndMovements.displayHeading,
          briefing.dealsAndMovements.bullets,
        );
      }
    },
    () => {
      if (
        briefing.regulatoryPolicyWatch !== undefined &&
        hasRows(briefing.regulatoryPolicyWatch)
      ) {
        pushBulletSection(
          "regulatory-policy-watch",
          briefing.regulatoryPolicyWatch.displayHeading,
          briefing.regulatoryPolicyWatch.bullets,
        );
      }
    },
    () => {
      const d = briefing.disruptorsOrTech;
      if (d === undefined) return;
      if (d.format === "prose") {
        pushBlock(
          [
            `${BEGIN} disruptors-or-tech`,
            DISPLAY_HEADING,
            collapseHeadingLine(d.displayHeading),
            FORMAT,
            "prose",
            PROSE,
            stripArticleMarkers(d.prose.trim()),
            END,
          ].join("\n"),
        );
      } else {
        if (!hasRows(d)) return;
        const lines: string[] = [
          `${BEGIN} disruptors-or-tech`,
          DISPLAY_HEADING,
          collapseHeadingLine(d.displayHeading),
          FORMAT,
          "bullets",
        ];
        for (const b of d.bullets) {
          lines.push(BULLET);
          if (b.title !== undefined && b.title.trim().length > 0) {
            lines.push(`${TITLE} ${collapseHeadingLine(b.title)}`);
          }
          pushBylineLines(lines, b);
          lines.push(withOptionalReadLine(stripArticleMarkers(b.text), b.url));
        }
        lines.push(END);
        pushBlock(lines.join("\n"));
      }
    },
    () => {
      if (
        briefing.quickHits === undefined ||
        briefing.quickHits.items.length === 0
      ) {
        return;
      }
      const qhLines: string[] = [
        `${BEGIN} quick-hits`,
        DISPLAY_HEADING,
        collapseHeadingLine(briefing.quickHits.displayHeading),
      ];
      for (const item of briefing.quickHits.items) {
        qhLines.push(ITEM);
        if (item.title !== undefined && item.title.trim().length > 0) {
          qhLines.push(`${TITLE} ${collapseHeadingLine(item.title)}`);
        }
        pushBylineLines(qhLines, item);
        qhLines.push(
          withOptionalReadLine(stripArticleMarkers(item.text), item.url),
        );
      }
      qhLines.push(END);
      pushBlock(qhLines.join("\n"));
    },
  ];

  for (const emit of bodyEmitters) {
    emit();
  }

  return parts.join("\n").trimEnd() + "\n";
};
