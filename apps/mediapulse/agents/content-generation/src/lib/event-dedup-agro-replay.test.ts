import { describe, expect, it } from "vitest";

import {
  eventEntryOf,
  findKnownEvent,
  type EventEntry,
} from "./event-dedup.js";
import type { SourceForGeneration } from "../types.js";

const AGRO_BRIMO_COPIES: ReadonlyArray<{ title: string; content: string }> = [
  {
    title:
      "BRImo Taiwan Resmi Diluncurkan, BRI Bidik Kemudahan Transaksi dan Remitansi PMI ke Indonesia - Koran Timor",
    content:
      "BRImo Taiwan Resmi Diluncurkan, BRI Bidik Kemudahan Transaksi dan Remitansi PMI ke Indonesia  TAIWAN, KORANTIMOR.COM,- PT Bank Rakyat Indonesia (Persero) Tbk resmi meluncurkan BRImo Taiwan, layanan perbankan digital bagi pekerja migran Indonesia dan diaspora di Taiwan. Peluncuran berlangsung di New Taipei City Hall pada 23 Agustus 2026. Total aset BRI Taipei telah mencapai lebih dari USD408 juta.",
  },
  {
    title: "BRI Perkuat Ekosistem Keuangan Diaspora Indonesia di Taiwan",
    content:
      "BRI meluncurkan BRImo Taiwan untuk memperkuat konektivitas finansial diaspora, sekaligus mendorong PMI mengelola remitansi secara produktif.",
  },
  {
    title:
      "Resmi Diluncurkan, BRImo Taiwan Solusi Perbankan Digital untuk PMI dan Diaspora Indonesia",
    content:
      "Resmi Diluncurkan, BRImo Taiwan Solusi Perbankan Digital untuk PMI dan Diaspora Indonesia  Bank Rakyat Indonesia atau BRI resmi meluncurkan BRImobile Taiwan yang menawarkan transaksi real-time termasuk remitansi lintas negara bagi pekerja migran Indonesia dan diaspora di Taiwan. BRI Taipei menargetkan menjangkau 30 persen dari 400.000 pekerja migran Indonesia sebagai pengguna BRImobile.",
  },
  {
    title:
      "BRI Luncurkan BRImo Taiwan, Perkuat Akses Keuangan bagi Diaspora Indonesia - Prokhatulistiwa",
    content:
      "Prokhatulistiwa.com — PT Bank Rakyat Indonesia (Persero) Tbk atau BRI resmi memperkenalkan BRImo Taiwan di New Taipei City Hall, Taiwan, pada 23 Agustus 2026.",
  },
  {
    title:
      "BRI Resmi Luncurkan BRImo Taiwan: Jembatan Layanan Keuangan Digital Bagi Diaspora dan Pekerja Migran Indonesia - Erapos",
    content:
      "ERAPOS ONLINE — PT Bank Rakyat Indonesia (Persero) Tbk (BRI) secara resmi memperluas jangkauan layanan perbankan digitalnya di kancah internasional dengan meluncurkan BRImo Taiwan bagi diaspora Indonesia.",
  },
];

const asSource = (row: {
  title: string;
  content: string;
}): SourceForGeneration =>
  ({
    url: `https://example.com/${encodeURIComponent(row.title)}`,
    title: row.title,
    content: row.content,
  }) as SourceForGeneration;

const collapse = (
  rows: ReadonlyArray<{ title: string; content: string }>,
): string[] => {
  const corpus: EventEntry[] = [];
  const kept: string[] = [];
  for (const row of rows) {
    const source = asSource(row);
    if (findKnownEvent(source, corpus) !== undefined) {
      continue;
    }
    kept.push(row.title);
    const entry = eventEntryOf(source);
    if (entry !== undefined) {
      corpus.push(entry);
    }
  }

  return kept;
};

describe("AGRO 2026-08-26 backfill replay", () => {
  it("drops the full-text duplicates of one launch that reached five slots", () => {
    const kept = collapse(AGRO_BRIMO_COPIES);

    expect(kept).toStrictEqual([
      AGRO_BRIMO_COPIES[0]?.title,
      AGRO_BRIMO_COPIES[1]?.title,
    ]);
  });

  it("leaves a description-only copy uncollapsed, because its anchors are too few", () => {
    const descriptionOnly = AGRO_BRIMO_COPIES[1];
    const representative = AGRO_BRIMO_COPIES[0];
    if (descriptionOnly === undefined || representative === undefined) {
      throw new Error("fixture missing");
    }
    const entry = eventEntryOf(asSource(representative));
    if (entry === undefined) {
      throw new Error("representative has no anchors");
    }

    expect(findKnownEvent(asSource(descriptionOnly), [entry])).toBeUndefined();
  });
});
