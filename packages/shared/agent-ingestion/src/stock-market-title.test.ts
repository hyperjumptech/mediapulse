import { describe, expect, it } from "vitest";

import { isStockMarketTitle } from "./stock-market-title";

describe("isStockMarketTitle", () => {
  it.each([
    "Rekomendasi Saham 19 November 2026: ASII, BBNI, INDF, SMGR, BBTN, GGRM",
    "Rekomendasi Saham 20 November 2026: ICBP, INET, ASII, TLKM, BULL, CMRY",
    "Stock Recommendations for 20 November 2026: ICBP, INET, ASII, TLKM, BULL, CMRY",
    "Prediksi IHSG dan Rekomendasi Saham 19 November 2026",
    "IHSG Hari Ini Merosot 0,92% ke 5.146, Sektor Saham Energi Pimpin Koreksi",
    "IHSG Hari Ini Anjlok 1,02% ke 5.194, Saham CPIN Merosot 2,1%",
    "Investor Asing Net Sell Rp 947 M Akhir Pekan, MBMA, EXCL dan MYOR Topang IHSG",
    "Asing Net Sell Rp 947 M di Akhir Pekan, MBMA, EXCL dan MYOR Topang IHSG",
    "Foreign Investors Net Sell Rp 947 M at Weekend, MBMA, EXCL and MYOR Support IHSG",
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
    "Deretan Saham dengan Laba Tumbuh tapi Harga Masih Diskon, Ada AMMN hingga ANTM",
    "Sederet Saham Tambang yang Masih Undervalued Jelang Akhir Tahun",
    "Is Freeport-McMoRan (NYSE:FCX) Grasberg Recovery Setting Up a Rebound?",
    "Consensus Cloud Solutions (NASDAQ: CCSI) Beats Earnings Estimates",
  ])("matches %s", (title) => {
    expect(isStockMarketTitle(title)).toBe(true);
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
    "Ramayana Gelar Diskon Akhir Tahun hingga 70 Persen",
    "Rights Issue Saham BBRI Dipatok Diskon 20% dari Harga Pasar",
    "Daftar Pemegang Saham ERAA Berubah Usai Private Placement",
    "Vale Indonesia Sets Out Plan for HPAL Plant in Pomalaa",
    "Kebijakan Set: Pemerintah Atur Ulang Tata Niaga Nikel",
  ])("leaves a corporate or business story alone: %s", (title) => {
    expect(isStockMarketTitle(title)).toBe(false);
  });
});
