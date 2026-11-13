import { describe, expect, it } from "vitest";

import {
  ampCandidates,
  articleMatch,
  canonicalForm,
  contentMatch,
  decideDomain,
  feedStats,
  isUsable,
  markdownToText,
  newestFirst,
  pickCorpus,
  summarize,
  variantUrls,
  wordCount,
} from "./fetch-domains-eval.mjs";

const cell = (overrides: Record<string, unknown>) => ({
  domain: "swa.co.id",
  variant: "baseline",
  kind: "failing",
  fetched: true,
  gateBlocked: false,
  gateReason: null,
  errorCategory: null,
  matchRatio: 1,
  usable: true,
  ...overrides,
});

const repeat = (count: number, overrides: Record<string, unknown>) =>
  Array.from({ length: count }, (_, index) =>
    cell({ url: `https://swa.co.id/read/${String(index)}`, ...overrides }),
  );

describe("URL variants", () => {
  it("strips query and fragment for the canonical form", () => {
    // Assert
    expect(
      canonicalForm("https://www.swa.co.id/read/telkom-laba?utm_source=x#top"),
    ).toBe("https://www.swa.co.id/read/telkom-laba");
  });

  it("skips the canonical variant when the URL is already canonical", () => {
    // Assert
    expect(
      variantUrls("canonical", "https://www.swa.co.id/read/telkom-laba"),
    ).toEqual([]);
  });

  it("offers a path suffix and an amp subdomain", () => {
    // Assert
    expect(ampCandidates("https://www.swa.co.id/read/telkom-laba/")).toEqual([
      "https://www.swa.co.id/read/telkom-laba/amp",
      "https://amp.swa.co.id/read/telkom-laba/",
    ]);
  });

  it("offers no AMP form for a URL that is already AMP", () => {
    // Assert
    expect(
      ampCandidates("https://portalpapua.pikiran-rakyat.com/amp/pr-123"),
    ).toEqual([]);
  });
});

describe("articleMatch", () => {
  it("scores the share of title words found in the body", () => {
    // Act
    const ratio = articleMatch(
      "OJK Terbitkan Aturan Penjaminan Polis",
      "Otoritas Jasa Keuangan (OJK) menerbitkan aturan baru tentang penjaminan polis asuransi.",
    );

    // Assert
    expect(ratio).toBeCloseTo(3 / 4);
  });

  it("scores a homepage body that never mentions the article low", () => {
    // Assert
    expect(
      articleMatch(
        "Laba Investortrust Naik Tajam",
        "Beranda Terkini Market Ekonomi Opini Indeks",
      ),
    ).toBe(0);
  });
});

describe("cell scoring", () => {
  it("counts words on whitespace", () => {
    // Assert
    expect(wordCount("  satu dua\ntiga  ")).toBe(3);
  });

  it("treats a gate-passed body that matches the article as usable", () => {
    // Assert
    expect(isUsable(cell({ matchRatio: 0.6 }))).toBe(true);
    expect(isUsable(cell({ matchRatio: 0.2 }))).toBe(false);
    expect(isUsable(cell({ gateBlocked: true }))).toBe(false);
  });
});

describe("pickCorpus", () => {
  it("takes the newest failing URLs and succeeded URLs as controls", () => {
    // Arrange
    const rows = [
      {
        domain: "ojk.go.id",
        url: "a",
        status: "gate_dropped",
        fetchedAt: "2026-11-01",
      },
      {
        domain: "ojk.go.id",
        url: "b",
        status: "gate_dropped",
        fetchedAt: "2026-11-03",
      },
      {
        domain: "ojk.go.id",
        url: "c",
        status: "succeeded",
        fetchedAt: "2026-11-02",
      },
      {
        domain: "other.id",
        url: "d",
        status: "fetch_failed",
        fetchedAt: "2026-11-04",
      },
    ];

    // Act
    const corpus = pickCorpus(rows, {
      domains: ["ojk.go.id"],
      failing: 1,
      controls: 1,
    });

    // Assert
    expect(corpus.map((row) => [row.url, row.kind])).toEqual([
      ["b", "failing"],
      ["c", "control"],
    ]);
  });
});

describe("decideDomain", () => {
  it("adopts a variant that fixes most failing URLs", () => {
    // Arrange
    const groups = summarize([
      ...repeat(10, {
        usable: false,
        gateBlocked: true,
        gateReason: "content_too_short",
        matchRatio: 0.1,
      }),
      ...repeat(8, { variant: "amp" }),
      ...repeat(2, { variant: "amp", usable: false }),
    ]);

    // Act
    const result = decideDomain("swa.co.id", groups);

    // Assert
    expect(result).toEqual({ decision: "adopt", variant: "amp" });
  });

  it("flags short bodies that match the article as short by nature", () => {
    // Arrange
    const groups = summarize(
      repeat(10, {
        usable: false,
        gateBlocked: true,
        gateReason: "content_too_short",
        matchRatio: 0.9,
        contentMatchRatio: 0.6,
      }),
    );

    // Assert
    expect(decideDomain("swa.co.id", groups).decision).toBe("short_by_nature");
  });

  it("declines to decide on fewer than eight URLs", () => {
    // Arrange
    const groups = summarize(repeat(5, { usable: false }));

    // Assert
    expect(decideDomain("swa.co.id", groups).decision).toBe("too_few_urls");
  });

  it("rejects a variant that breaks the control URLs", () => {
    // Arrange
    const groups = summarize([
      ...repeat(10, {
        usable: false,
        fetched: false,
        errorCategory: "provider_data_invalid",
        matchRatio: 0,
      }),
      ...repeat(10, { variant: "markdown" }),
      ...repeat(3, { kind: "control" }),
      ...repeat(3, { kind: "control", variant: "markdown", usable: false }),
    ]);

    // Assert
    expect(decideDomain("swa.co.id", groups).decision).toBe("no_serper_fix");
  });
});

describe("feed scoring", () => {
  const now = Date.parse("2026-11-13T06:00:00Z");
  const items = [
    {
      url: "https://money.kompas.com/read/2026/11/13/a",
      publishedAt: "2026-11-13T05:00:00Z",
    },
    {
      url: "https://money.kompas.com/read/2026/11/11/b",
      publishedAt: "2026-11-11T05:00:00Z",
    },
    {
      url: "https://news.google.com/rss/articles/xyz",
      publishedAt: "2026-11-13T04:00:00Z",
    },
    { url: "https://money.kompas.com/read/c" },
  ];

  it("counts fresh and direct items", () => {
    // Act
    const stats = feedStats(items, {
      now,
      isExcluded: (url: string) => url.startsWith("https://news.google.com/"),
    });

    // Assert
    expect(stats).toEqual({ items: 4, fresh: 2, direct: 3 });
  });

  it("orders items newest first, undated last", () => {
    // Assert
    expect(newestFirst(items).map((item) => item.url.slice(-1))).toEqual([
      "a",
      "z",
      "b",
      "c",
    ]);
  });
});

describe("contentMatch", () => {
  const title =
    "Kemenperin Petakan Delapan Aspek Pengembangan Kawasan Industri";

  it("ignores lines that only repeat the headline", () => {
    // Act
    const ratio = contentMatch(
      title,
      `${title} — TVRI News\nJumat, 13 November 2026\nMasuk\n${title} — TVRI News | TVRI News`,
    );

    // Assert
    expect(ratio).toBe(0);
  });

  it("keeps a lead sentence that restates the story", () => {
    // Act
    const ratio = contentMatch(
      title,
      `${title}\nKementerian Perindustrian memetakan delapan aspek pengembangan kawasan industri untuk menarik investasi baru.`,
    );

    // Assert
    expect(ratio).toBeGreaterThanOrEqual(0.3);
  });
});

describe("markdownToText", () => {
  it("drops meta lines, images and link targets but keeps link text", () => {
    // Act
    const text = markdownToText(
      "# Judul Berita\nmeta-author: Redaksi\n![foto](https://cdn.example/a.jpg)\nBaca [laporan lengkap](https://example.com/a) di sini.",
    );

    // Assert
    expect(text).toBe("Judul Berita\n\nBaca laporan lengkap di sini.");
  });
});
