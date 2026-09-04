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

const scored = (
  title: string,
  content: string,
  section: string,
  sectionScore: number,
): SourceForGeneration => ({
  ...source(title, content, section),
  sectionScore,
});

describe("dedupeCrossSectionSourceEvents", () => {
  it("returns the copies it dropped so they can stand in later", () => {
    const sources = [
      scored(
        "Saham BYAN melesat usai isu diakuisisi Haji Isam",
        "Shares of Bayan Resources jumped after reports that Haji Isam would acquire a controlling stake in BYAN.",
        "competitiveLandscape",
        0.8,
      ),
      scored(
        "Bayan Resources buka suara soal rumor akuisisi Haji Isam",
        "Bayan Resources responded to reports that Haji Isam would acquire a controlling stake in BYAN.",
        "competitiveLandscape",
        0.6,
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(titleOf(result.sources)).toStrictEqual([
      "Saham BYAN melesat usai isu diakuisisi Haji Isam",
    ]);
    expect(titleOf(result.duplicates)).toStrictEqual([
      "Bayan Resources buka suara soal rumor akuisisi Haji Isam",
    ]);
  });

  it("returns no duplicates when nothing was dropped", () => {
    const sources = [
      source(
        "Telkomsel wins block",
        "Telkomsel secured the largest 700 spectrum block in the auction.",
        "competitiveLandscape",
      ),
      source(
        "New numbering rules",
        "Kominfo issued fresh mobile numbering portability rules effective next quarter.",
        "regulatoryPolicyWatch",
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.duplicates).toStrictEqual([]);
  });

  it("keeps the higher-scoring copy even when it sits in a later-ranked section", () => {
    const sources = [
      scored(
        "Bayan Resources buka suara soal rumor akuisisi Haji Isam",
        "Bayan Resources responded to reports that Haji Isam would acquire a controlling stake in BYAN.",
        "competitiveLandscape",
        0.6,
      ),
      scored(
        "Saham BYAN melesat usai isu diakuisisi Haji Isam",
        "Shares of Bayan Resources jumped after reports that Haji Isam would acquire a controlling stake in BYAN.",
        "dealsAndMovements",
        0.8,
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(titleOf(result.sources)).toStrictEqual([
      "Saham BYAN melesat usai isu diakuisisi Haji Isam",
    ]);
    expect(result.drops[0]?.sectionKey).toBe("competitiveLandscape");
    expect(result.drops[0]?.matchedSectionKey).toBe("dealsAndMovements");
  });

  it("falls back to canonical section rank when scores tie", () => {
    const sources = [
      scored(
        "Saham BYAN melesat usai isu diakuisisi Haji Isam",
        "Shares of Bayan Resources jumped after reports that Haji Isam would acquire a controlling stake in BYAN.",
        "dealsAndMovements",
        0.6,
      ),
      scored(
        "Bayan Resources buka suara soal rumor akuisisi Haji Isam",
        "Bayan Resources responded to reports that Haji Isam would acquire a controlling stake in BYAN.",
        "competitiveLandscape",
        0.6,
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(titleOf(result.sources)).toStrictEqual([
      "Bayan Resources buka suara soal rumor akuisisi Haji Isam",
    ]);
  });

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

  it("pairs on headline when neither source carries a publish date", () => {
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

    expect(result.removedCount).toBe(1);
    expect(result.sources[0]!.section).toBe("competitiveLandscape");
  });

  it("pairs a dated source with an undated retelling of the same story", () => {
    const sources = [
      {
        ...source(
          "Telkom Rampungkan Spin-Off InfraCo Tahap 2, InfraNexia Kelola 112.000 Km Fiber",
          "Pengalihan aset dan bisnis dengan nilai transaksi mencapai Rp49,9 triliun.",
          "dealsAndMovements",
        ),
        publishedAt: "2026-08-09T00:00:00.000Z",
      },
      source(
        "Telkom Rampungkan Spin-Off InfraCo, InfraNexia Kelola Aset Jaringan",
        "Manajemen menyebut transformasi digital berlanjut setelah pemisahan usaha.",
        "competitiveLandscape",
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.removedCount).toBe(1);
    expect(result.sources).toHaveLength(1);
    expect(result.drops[0]!.matchedSectionKey).toBe("competitiveLandscape");
  });

  it("still keeps undated articles whose headlines share too little", () => {
    const sources = [
      source(
        "BBCA Cetak Laba Rp29,5 Triliun di Semester I 2026",
        "Bank melaporkan pertumbuhan kredit korporasi sebagai pendorong utama.",
        "quickHits",
      ),
      source(
        "OJK Terbitkan Aturan Baru Pelaporan Transaksi Pindar",
        "Regulator mewajibkan penyelenggara menyampaikan data pendanaan secara berkala.",
        "regulatoryPolicyWatch",
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

describe("dedupeCrossSectionSourceEvents accented headlines", () => {
  it("collapses two reports of one event whose headlines spell a name with and without a tilde", () => {
    const sources = [
      scored(
        "Batu Bara RI Bisa Naik ke US$140/Ton Gegara El Niño Ganggu Ekspor",
        "Harga batu bara Indonesia bisa naik ke US$140 per ton karena El Niño mengganggu ekspor.",
        "industryPulse",
        0.8,
      ),
      scored(
        "Harga CPO dan Batu Bara Naik Dipicu Khawatir Pasokan Dampak El Nino",
        "Harga CPO dan batu bara naik dipicu kekhawatiran pasokan akibat dampak El Nino.",
        "industryPulse",
        0.6,
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(titleOf(result.sources)).toStrictEqual([
      "Batu Bara RI Bisa Naik ke US$140/Ton Gegara El Niño Ganggu Ekspor",
    ]);
    expect(result.removedCount).toBe(1);
  });
});

describe("dedupeCrossSectionSourceEvents Indonesian affixation", () => {
  it("collapses two reports of one regulation whose headlines inflect the same verbs", () => {
    const sources = [
      scored(
        "SE Menkomdigi Terbit, Operator Dilarang Hanguskan Sisa Kuota Internet Pelanggan",
        "Kementerian Komunikasi dan Digital menerbitkan surat edaran yang melarang operator menghanguskan sisa kuota internet pelanggan.",
        "regulatoryPolicyWatch",
        0.8,
      ),
      scored(
        "Aturan Komdigi Larang Kuota Internet Hangus, Begini Respons XLSMART",
        "Pemerintah melarang operator menghanguskan kuota internet berbayar milik pelanggan.",
        "regulatoryPolicyWatch",
        0.6,
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(titleOf(result.sources)).toStrictEqual([
      "SE Menkomdigi Terbit, Operator Dilarang Hanguskan Sisa Kuota Internet Pelanggan",
    ]);
  });

  it("keeps two financial stories that share only market vocabulary", () => {
    const sources = [
      scored(
        "Ekspansi Kredit dan Penguatan Dana Murah Bawa Laba BRI Tumbuh 17,5 Persen Jadi Rp31,2 Triliun",
        "Laba bersih BRI tumbuh 17,5 persen menjadi Rp31,2 triliun pada semester I 2026.",
        "issuerPerformance",
        0.8,
      ),
      scored(
        "Kredit UMKM BRI Tumbuh 8,6% menjadi Rp1.235,4 Triliun Semester I/2026",
        "Penyaluran kredit UMKM BRI tumbuh 8,6 persen menjadi Rp1.235,4 triliun.",
        "competitiveLandscape",
        0.6,
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.sources).toHaveLength(2);
  });
});
