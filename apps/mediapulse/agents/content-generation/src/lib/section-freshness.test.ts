import { describe, expect, it } from "vitest";

import type { SourceForGeneration } from "../types.js";
import {
  DEFAULT_SECTION_MAX_AGE_DAYS,
  dropStaleForSection,
  SECTION_MAX_AGE_DAYS,
} from "./section-freshness.js";

const NOW = new Date("2026-08-05T00:00:00.000Z");

const source = (
  title: string,
  section: string,
  publishedAt?: string,
): SourceForGeneration => ({
  dataSourceId: `ds-${title}`,
  url: `https://example.com/${encodeURIComponent(title)}`,
  title,
  content: "body",
  section,
  ...(publishedAt !== undefined ? { publishedAt } : {}),
});

describe("dropStaleForSection", () => {
  it("drops the seven-day-old price story that led AADI's industry pulse", () => {
    const result = dropStaleForSection(
      [
        source(
          "Coal Prices Weaken Despite Increased Demand in Asia",
          "industryPulse",
          "2026-07-29T00:00:00.000Z",
        ),
      ],
      NOW,
    );

    expect(result.droppedCount).toBe(1);
    expect(result.drops[0]?.section).toBe("industryPulse");
    expect(result.drops[0]?.ageDays).toBe(7);
  });

  it("keeps the same age in a section whose news holds its value", () => {
    const result = dropStaleForSection(
      [
        source(
          "Industrial Zone Bill to Reduce Investment Barriers",
          "regulatoryPolicyWatch",
          "2026-07-29T00:00:00.000Z",
        ),
      ],
      NOW,
    );

    expect(result.droppedCount).toBe(0);
  });

  it("keeps a fresh industry-pulse story", () => {
    const result = dropStaleForSection(
      [
        source(
          "Coal price falls 1.25%",
          "industryPulse",
          "2026-08-03T00:00:00.000Z",
        ),
      ],
      NOW,
    );

    expect(result.droppedCount).toBe(0);
  });

  it("keeps a source carrying no publish date, since an unknown date is not staleness", () => {
    const result = dropStaleForSection(
      [source("Undated wire copy", "industryPulse")],
      NOW,
    );

    expect(result.droppedCount).toBe(0);
    expect(result.sources).toHaveLength(1);
  });

  it("keeps a source whose publish date cannot be parsed", () => {
    const result = dropStaleForSection(
      [source("Malformed date", "industryPulse", "not-a-date")],
      NOW,
    );

    expect(result.droppedCount).toBe(0);
  });

  it("applies the default ceiling to a section with no entry of its own", () => {
    const stale = dropStaleForSection(
      [
        source(
          "Issuer H1 results",
          "issuerPerformance",
          "2026-07-27T00:00:00.000Z",
        ),
      ],
      NOW,
    );
    const fresh = dropStaleForSection(
      [
        source(
          "Issuer H1 results",
          "issuerPerformance",
          "2026-07-30T00:00:00.000Z",
        ),
      ],
      NOW,
    );

    expect(SECTION_MAX_AGE_DAYS.issuerPerformance).toBeUndefined();
    expect(DEFAULT_SECTION_MAX_AGE_DAYS).toBe(7);
    expect(stale.droppedCount).toBe(1);
    expect(fresh.droppedCount).toBe(0);
  });

  it("never loosens the collection window, which already caps at seven days", () => {
    for (const limit of Object.values(SECTION_MAX_AGE_DAYS)) {
      expect(limit).toBeLessThanOrEqual(DEFAULT_SECTION_MAX_AGE_DAYS);
    }
  });
});

describe("dropStaleForSection quoted levels", () => {
  const now = new Date("2026-09-04T00:00:00Z");

  it("drops a price quoted six days ago even when the article carries no publish date", () => {
    const sources = [
      {
        dataSourceId: "ds-gold",
        url: "https://example.com/gold",
        title:
          "Antam Gold Price at Pegadaian August 29, 2026, Check the Latest Details",
        content: "Harga emas Antam turun Rp5.000.",
        section: "quickHits",
      },
    ] as const;

    const result = dropStaleForSection([...sources], now);

    expect(result.droppedCount).toBe(1);
    expect(result.sources).toStrictEqual([]);
  });

  it("keeps a price quoted the day before", () => {
    const sources = [
      {
        dataSourceId: "ds-fx",
        url: "https://example.com/fx",
        title: "Kurs Dolar AS di BCA Hari Ini, 3 September 2026",
        content: "Kurs dolar AS hari ini.",
        section: "quickHits",
      },
    ] as const;

    const result = dropStaleForSection([...sources], now);

    expect(result.droppedCount).toBe(0);
  });

  it("leaves a dated development alone", () => {
    const sources = [
      {
        dataSourceId: "ds-buyback",
        url: "https://example.com/buyback",
        title:
          "Erajaya Prepares Rp 500 Billion Stock Buyback Starting September 4, 2026",
        content: "Erajaya menyiapkan buyback.",
        section: "issuerNews",
      },
    ] as const;

    const result = dropStaleForSection([...sources], now);

    expect(result.droppedCount).toBe(0);
  });
});
