import { describe, expect, it } from "vitest";

import type { SourceForGeneration } from "../types.js";
import { dedupeCrossSectionSourceEvents } from "./event-dedup.js";

const source = (
  title: string,
  content: string,
  section: string,
): SourceForGeneration => ({
  dataSourceId: `ds-${title}`,
  url: `https://example.com/${encodeURIComponent(title)}`,
  title,
  content,
  section,
});

const titleOf = (sources: readonly SourceForGeneration[]): string[] =>
  sources.map((entry) => entry.title);

describe("dedupeCrossSectionSourceEvents", () => {
  it("drops a lower-priority source that repeats a higher-priority section's event", () => {
    const sources = [
      source(
        "Telkomsel wins block",
        "Telkomsel secured the largest 700 spectrum block in the auction, strengthening its position against Indosat and Axiata.",
        "competitiveLandscape",
      ),
      source(
        "Kominfo concludes auction",
        "Kominfo concluded the 700 spectrum auction, allocating frequencies to Telkomsel, Indosat, and Axiata.",
        "regulatoryPolicyWatch",
      ),
      source(
        "New numbering rules",
        "Kominfo issued fresh mobile numbering portability rules effective next quarter.",
        "regulatoryPolicyWatch",
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.removedCount).toBe(1);
    expect(titleOf(result.sources)).toEqual([
      "Telkomsel wins block",
      "New numbering rules",
    ]);
    expect(result.drops[0]).toMatchObject({
      sectionKey: "regulatoryPolicyWatch",
      matchedSectionKey: "competitiveLandscape",
    });
  });

  it("suppresses a source that repeats the Industry Pulse lead event", () => {
    const sources = [
      source(
        "Telkomsel wins block",
        "Telkomsel secured the largest 700 spectrum block in the auction against Indosat and Axiata.",
        "competitiveLandscape",
      ),
      source(
        "Spectrum auction concludes",
        "The 700 spectrum auction concluded, with Kominfo allocating frequencies to Telkomsel, Indosat, and Axiata to accelerate national 5G rollout.",
        "industryPulse",
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.removedCount).toBe(1);
    expect(titleOf(result.sources)).toEqual(["Spectrum auction concludes"]);
    expect(result.drops[0]?.matchedSectionKey).toBe("industryPulse");
  });

  it("keeps genuinely distinct events that share few anchors", () => {
    const sources = [
      source(
        "Telkomsel revenue",
        "Telkomsel reported quarterly revenue growth driven by data subscriptions.",
        "competitiveLandscape",
      ),
      source(
        "Axiata acquires fintech",
        "Axiata announced the acquisition of a regional payments startup to expand digital services.",
        "dealsAndMovements",
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.removedCount).toBe(0);
    expect(result.sources).toHaveLength(2);
  });

  it("keeps the higher-scoring copy when both candidates sit in the same section", () => {
    const sources = [
      {
        ...source(
          "Auction recap",
          "Kominfo concluded the 700 spectrum auction, allocating frequencies to Telkomsel, Indosat, and Axiata.",
          "regulatoryPolicyWatch",
        ),
        sectionScore: 0.4,
      },
      {
        ...source(
          "Auction result",
          "Kominfo concluded the 700 spectrum auction, allocating frequencies to Telkomsel, Indosat, and Axiata nationwide.",
          "regulatoryPolicyWatch",
        ),
        sectionScore: 0.9,
      },
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.removedCount).toBe(1);
    expect(titleOf(result.sources)).toEqual(["Auction result"]);
  });

  it("drops a same-day second telling whose headline repeats the kept one", () => {
    const sources = [
      {
        ...source(
          "Konser 35 Tahun Twilite Orchestra Ludes, BRI Buka Akses Eksklusif",
          "Kolaborasi perbankan mendukung ekonomi kreatif nasional lewat program apresiasi pelanggan.",
          "competitiveLandscape",
        ),
        publishedAt: "2026-07-31T09:00:00.000Z",
      },
      {
        ...source(
          "BRI Dukung Ekonomi Kreatif Lewat Konser Twilite Orchestra 35 Tahun",
          "Tiket umum habis dalam satu jam, manajemen menyebut animo penonton sangat tinggi.",
          "quickHits",
        ),
        publishedAt: "2026-07-31T14:20:00.000Z",
      },
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.removedCount).toBe(1);
    expect(titleOf(result.sources)).toEqual([
      "Konser 35 Tahun Twilite Orchestra Ludes, BRI Buka Akses Eksklusif",
    ]);
    expect(result.drops[0]).toMatchObject({ sectionKey: "quickHits" });
  });

  it("drops a second telling stamped one day later by another outlet", () => {
    const sources = [
      {
        ...source(
          "Indosat 5G Expands Network to Support Gaming and Digital School in Balikpapan",
          "Indosat Ooredoo Hutchison memperkuat jaringan 5G di sejumlah titik aktivitas warga Balikpapan.",
          "competitiveLandscape",
        ),
        publishedAt: "2026-08-02T09:00:00.000Z",
      },
      {
        ...source(
          "Indosat Strengthens 5G Network in Balikpapan, Boosts Gaming and Digital Education",
          "Perluasan layanan 5G Indosat di kota Balikpapan menyasar pelaku UMKM dan sektor pendidikan.",
          "competitiveLandscape",
        ),
        publishedAt: "2026-08-03T14:20:00.000Z",
      },
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.removedCount).toBe(1);
    expect(titleOf(result.sources)).toEqual([
      "Indosat 5G Expands Network to Support Gaming and Digital School in Balikpapan",
    ]);
  });

  it("keeps a repeated headline shape published more than a day apart", () => {
    const sources = [
      {
        ...source(
          "Konser 35 Tahun Twilite Orchestra Ludes, BRI Buka Akses Eksklusif",
          "Kolaborasi perbankan mendukung ekonomi kreatif nasional lewat program apresiasi pelanggan.",
          "competitiveLandscape",
        ),
        publishedAt: "2026-07-31T09:00:00.000Z",
      },
      {
        ...source(
          "BRI Dukung Ekonomi Kreatif Lewat Konser Twilite Orchestra 35 Tahun",
          "Tiket umum habis dalam satu jam, manajemen menyebut animo penonton sangat tinggi.",
          "quickHits",
        ),
        publishedAt: "2026-08-02T14:20:00.000Z",
      },
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.removedCount).toBe(0);
    expect(result.sources).toHaveLength(2);
  });

  it("never pairs on headline alone when a source carries no publish date", () => {
    const sources = [
      source(
        "Konser 35 Tahun Twilite Orchestra Ludes, BRI Buka Akses Eksklusif",
        "Kolaborasi perbankan mendukung ekonomi kreatif nasional lewat program apresiasi pelanggan.",
        "competitiveLandscape",
      ),
      source(
        "BRI Dukung Ekonomi Kreatif Lewat Konser Twilite Orchestra 35 Tahun",
        "Tiket umum habis dalam satu jam, manajemen menyebut animo penonton sangat tinggi.",
        "quickHits",
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.removedCount).toBe(0);
  });

  it("keeps same-day articles whose headlines share too little", () => {
    const sources = [
      {
        ...source(
          "BBCA Cetak Laba Rp29,5 Triliun di Semester I 2026",
          "Bank melaporkan pertumbuhan kredit korporasi sebagai pendorong utama.",
          "quickHits",
        ),
        publishedAt: "2026-07-29T02:00:00.000Z",
      },
      {
        ...source(
          "BCA Ungkap Penyebab NIM Turun 50 Bps pada Semester I 2026",
          "Manajemen menjelaskan penyesuaian suku bunga kredit sejak tahun lalu.",
          "quickHits",
        ),
        publishedAt: "2026-07-29T08:30:00.000Z",
      },
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.removedCount).toBe(0);
    expect(result.sources).toHaveLength(2);
  });

  it("preserves the caller's ordering among kept sources", () => {
    const sources = [
      source(
        "Quick note",
        "A minor logistics update from a regional port.",
        "quickHits",
      ),
      source(
        "Policy shift",
        "The ministry revised import licensing thresholds for refined metals.",
        "regulatoryPolicyWatch",
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(titleOf(result.sources)).toEqual(["Quick note", "Policy shift"]);
  });
});
