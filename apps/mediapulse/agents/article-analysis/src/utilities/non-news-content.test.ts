/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { nonNewsContentClass } from "./non-news-content";

describe("nonNewsContentClass", () => {
  it.each([
    [
      "PT Vale Buka Lowongan Kerja Nasional untuk 2 Posisi",
      "PT Vale Indonesia membuka dua posisi. Lamaran dibuka 1 hingga 8 September 2026.",
      "recruitment",
    ],
    [
      "BCA Buka Management Trainee Program 2026 Batch 2, Cek Syarat dan Tahapan Seleksinya",
      "Program ini ditujukan bagi lulusan baru yang ingin berkarier di BCA.",
      "recruitment",
    ],
    [
      "PT Vale Sosialisasi Kebakaran Hutan dan Lahan di Desa Totobo",
      "PT Vale Indonesia Tbk menggelar sosialisasi pencegahan kebakaran hutan di Desa Totobo.",
      "community_activity",
    ],
    [
      "Kaltim percayakan Desa Kahala wakili lomba mitigasi stunting nasional",
      "Desa Kahala mewakili Kalimantan Timur dalam lomba tingkat nasional.",
      "competition_call",
    ],
  ])("classifies %s", (title, content, expected) => {
    expect(nonNewsContentClass(title, content)).toBe(expected);
  });

  it.each([
    [
      "Vale Bersiap Operasikan 3 Smelter Nikel HPAL",
      "PT Vale Indonesia bersiap mengoperasikan tiga smelter dengan investasi US$2 miliar.",
    ],
    [
      "Laba Bank Mandiri Naik 24,4 Persen jadi Rp30,4 Triliun",
      "Bank Mandiri membukukan laba bersih Rp30,4 triliun pada semester I 2026.",
    ],
    [
      "BPOM Perketat Batas Migrasi BPA pada Kemasan Pangan",
      "BPOM menetapkan batas migrasi BPA sebesar 0,05 mg/kg.",
    ],
  ])("leaves ordinary news alone: %s", (title, content) => {
    expect(nonNewsContentClass(title, content)).toBeNull();
  });

  it("keeps a recruitment story that reports a hiring figure", () => {
    const title = "Erajaya Buka Lowongan Kerja untuk 500 Posisi Baru";
    const content =
      "Erajaya menambah kapasitas gerai dan membuka 500 posisi baru tahun ini.";

    expect(nonNewsContentClass(title, content)).toBeNull();
  });

  it("keeps a community programme carrying an investment figure", () => {
    const title = "PT Vale Sosialisasi Program Pemberdayaan di Luwu Timur";
    const content =
      "Program ini didukung investasi Rp120 miliar untuk pemberdayaan masyarakat.";

    expect(nonNewsContentClass(title, content)).toBeNull();
  });

  describe("stock-market stories", () => {
    it("classifies a stock headline as stock_market", () => {
      expect(
        nonNewsContentClass(
          "Investor Asing Net Sell Rp 947 M Akhir Pekan, MBMA, EXCL dan MYOR Topang IHSG",
          "",
        ),
      ).toBe("stock_market");
    });

    it("rejects a stock story even when the body carries figures", () => {
      const title =
        "Rekomendasi Saham 19 November 2026: ASII, BBNI, INDF, SMGR, BBTN, GGRM";
      const content =
        "IHSG ditutup melemah 1,07% disertai dengan aksi jual asing Rp 423 miliar.";

      expect(nonNewsContentClass(title, content)).toBe("stock_market");
    });

    it("keeps a corporate action reported in share terms", () => {
      expect(
        nonNewsContentClass(
          "Emiten EXCL Siapkan Rp 1 Triliun Buat Buyback Saham",
          "",
        ),
      ).toBeNull();
    });

    it("judges the title alone, so a market recap in the body does not reject the story", () => {
      const title = "Emiten BTPN Bakal Go Private dan Delisting";
      const content =
        "Sebelumnya, Indeks Harga Saham Gabungan (IHSG) hari ini ditutup merosot 0,92% menjadi 5.146,32.";

      expect(nonNewsContentClass(title, content)).toBeNull();
    });
  });
});
