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
    it.each([
      "Rekomendasi Saham 19 November 2026: ASII, BBNI, INDF, SMGR, BBTN, GGRM",
      "Prediksi IHSG dan Rekomendasi Saham 19 November 2026",
      "IHSG Hari Ini Merosot 0,92% ke 5.146, Sektor Saham Energi Pimpin Koreksi",
      "IHSG Hari Ini Anjlok 1,02% ke 5.194, Saham CPIN Merosot 2,1%",
      "Investor Asing Net Sell Rp 947 M Akhir Pekan, MBMA, EXCL dan MYOR Topang IHSG",
      "Net Sell Asing Tembus Rp 2,6 T Sepekan, Saham GOTO dan BUMI Ramai Diperdagangkan",
      "Diborong Asing, Harga BRIS Menanjak di Tengah Potensi Naik ke KBMI 4",
      "Efek LQ45, ERAA Melesat 11% di November dan Berpeluang Lanjut",
      "Masuk Indeks LQ45, Prospek Saham ERAA Masih Membara",
      "Krakatau Steel (KRAS) Gandeng JOVO Group Bangun Terminal LNG, Begini Prospek Sahamnya",
      "RI-China Sepakat Kembangkan Coal to Ethanol, Simak Dampaknya ke Saham BUMI dan PTBA",
      "RI Mau Kembangkan Pembangkit Nuklir, Saham Apa yang Bakal Menyala?",
      "Bursa Saham Asia Hari Ini Melemah, Investor Menanti Debut Anthropic",
      "Bursa AS Melemah Pasca IPO Anthropic Gagal Meredakan Kecemasan AI",
      "MSCI Evaluasi Status Pasar Indonesia, Pinnacle Soroti Penindakan Saham Bermasalah",
      "Harga Saham SMAR Naik 5% Usai Rilis Kinerja",
      "Wilmar shares fell 3% after weak palm oil margins",
      "Top Gainers Pekan Ini: Saham Perkebunan Memimpin",
    ])("classifies %s", (title) => {
      expect(nonNewsContentClass(title, "")).toBe("stock_market");
    });

    it("rejects a stock story even when the body carries figures", () => {
      const title =
        "Rekomendasi Saham 19 November 2026: ASII, BBNI, INDF, SMGR, BBTN, GGRM";
      const content =
        "IHSG ditutup melemah 1,07% disertai dengan aksi jual asing Rp 423 miliar.";

      expect(nonNewsContentClass(title, content)).toBe("stock_market");
    });

    it.each([
      "Emiten EXCL Siapkan Rp 1 Triliun Buat Buyback Saham",
      "Emiten BFIN Tebar Dividen Interim Rp 35 per Saham, Cek Jadwalnya",
      "BCA (BBCA) Tebar Dividen Interim Rp 35 per Saham, Total 2026 Naik 45,5%",
      "Laba per Saham Naik 12% pada Kuartal III 2026",
      "Cakrawala Nexus Investama Akuisisi 29,87% Saham INET",
      "Investasi Sukses Bersama Beli 1,47 Miliar Saham WIFI",
      "Operator SPBU BP-AKR Caplok 90 Persen Saham Vivo Energy di Indonesia",
      "SMBC Mau Go Private dan Delisting, Gelar RUPSLB Akhir November",
      "Ada Lebih dari 5 Perusahaan Antre IPO, Ini Bocoran dari BRI Danareksa",
      "Penjualan PT Timah Melonjak 72% Selama 9 Bulan di 2026",
      "Harga Emas Antam Lesu, Buyback Anjlok Rp 203 Ribu dalam Sepekan",
      "GAPKI Genjot Percepatan Peremajaan Sawit Rakyat, Ini Respons Pemerintah",
    ])("keeps a corporate or business story: %s", (title) => {
      expect(nonNewsContentClass(title, "")).toBeNull();
    });

    it("judges the title alone, so a market recap in the body does not reject the story", () => {
      const title = "Emiten BTPN Bakal Go Private dan Delisting";
      const content =
        "Sebelumnya, Indeks Harga Saham Gabungan (IHSG) hari ini ditutup merosot 0,92% menjadi 5.146,32.";

      expect(nonNewsContentClass(title, content)).toBeNull();
    });
  });
});
