/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  canonicalizeUrl,
  classifyNoisyUrl,
} from "./article-source-url-filter.js";

describe("canonicalizeUrl", () => {
  it("strips hashes and tracking params while preserving non-tracking params", () => {
    const canonical = canonicalizeUrl(
      "https://Finance.Yahoo.com/quote/BBCA.JK/?utm_source=x&region=ID#fragment",
    );

    expect(canonical).toBe("https://finance.yahoo.com/quote/BBCA.JK?region=ID");
  });

  it("throws when the input is not a valid absolute URL", () => {
    expect(() => canonicalizeUrl("not-a-url")).toThrow();
  });

  it("returns origin only when path is root and there is no query string", () => {
    expect(canonicalizeUrl("https://Example.COM/")).toBe("https://example.com");
  });
});

describe("classifyNoisyUrl", () => {
  it("blocks malformed URLs as path noise", () => {
    const decision = classifyNoisyUrl("not-a-url");

    expect(decision).toEqual({
      blocked: true,
      reason: "blocked_path",
      canonicalUrl: "not-a-url",
    });
  });

  it.each([
    {
      name: "Yahoo Finance quote (US host)",
      url: "https://finance.yahoo.com/quote/BBCA.JK/",
      reason: "blocked_host_path" as const,
    },
    {
      name: "Yahoo Finance quote (regional host)",
      url: "https://sg.finance.yahoo.com/quote/NJ9.F/news/",
      reason: "blocked_host_path" as const,
    },
    {
      name: "CNBC quotes",
      url: "https://www.cnbc.com/quotes/BBCA",
      reason: "blocked_host_path" as const,
    },
    {
      name: "MSN stock details",
      url: "https://www.msn.com/en-us/money/stockdetails/bbca-id-stock/fi-bn91jc",
      reason: "blocked_host_path" as const,
    },
    {
      name: "Bloomberg company profile",
      url: "https://www.bloomberg.com/profile/company/BBCA:IJ",
      reason: "blocked_host_path" as const,
    },
    {
      name: "Bloomberg quote",
      url: "https://www.bloomberg.com/quote/BBCA:IJ",
      reason: "blocked_host_path" as const,
    },
    {
      name: "SeekingAlpha symbol hub",
      url: "https://seekingalpha.com/symbol/BBCA",
      reason: "blocked_host_path" as const,
    },
    {
      name: "Investing equities hub",
      url: "https://www.investing.com/equities/bnk-central-as",
      reason: "blocked_host_path" as const,
    },
    {
      name: "Reuters markets company page",
      url: "https://www.reuters.com/markets/companies/BBCA.JK/",
      reason: "blocked_host_path" as const,
    },
    {
      name: "TradingView symbols hub",
      url: "https://www.tradingview.com/symbols/IDX-BBCA/news/",
      reason: "blocked_host_path" as const,
    },
    {
      name: "Morningstar stock quote",
      url: "https://www.morningstar.com/stocks/xidx/pgeo/quote",
      reason: "blocked_host_path" as const,
    },
    {
      name: "MarketBeat stock hub",
      url: "https://www.marketbeat.com/stocks/OTCMKTS/PBCRY/",
      reason: "blocked_host_path" as const,
    },
    {
      name: "GuruFocus stock summary",
      url: "https://www.gurufocus.com/stock/ISX:BBCA/summary",
      reason: "blocked_host_path" as const,
    },
    {
      name: "StockAnalysis ETF history",
      url: "https://stockanalysis.com/etf/bbca/history/",
      reason: "blocked_host_path" as const,
    },
    {
      name: "Fintel equity hub",
      url: "https://fintel.io/s/id/bbca",
      reason: "blocked_host_path" as const,
    },
    {
      name: "sectors.app ticker hub",
      url: "https://sectors.app/idx/bbca",
      reason: "blocked_host_path" as const,
    },
    {
      name: "Pluang asset hub",
      url: "https://pluang.com/en/asset/indo-stock/PGEO?assetTab=financial",
      reason: "blocked_host_path" as const,
    },
    {
      name: "Perplexity finance hub",
      url: "https://www.perplexity.ai/finance/BBCA.JK/earnings",
      reason: "blocked_host_path" as const,
    },
    {
      name: "Quartr company hub",
      url: "https://quartr.com/companies/pt-bank-central-asia-tbk_16028",
      reason: "blocked_host_path" as const,
    },
    {
      name: "Marketscreener finances",
      url: "https://www.marketscreener.com/quote/stock/PT-BANK-CENTRAL-ASIA-TBK-6493397/finances/",
      reason: "blocked_host_path" as const,
    },
    {
      name: "Scribd document",
      url: "https://www.scribd.com/document/924346448/Pt-Bank-Central-Asia-Tbk-06-11-2025",
      reason: "blocked_host_path" as const,
    },
    {
      name: "ResearchGate publication",
      url: "https://www.researchgate.net/publication/385635909_Strategic_Transformation",
      reason: "blocked_host_path" as const,
    },
    {
      name: "TradingEconomics ticker token path",
      url: "https://tradingeconomics.com/bbca:ij",
      reason: "blocked_host_path" as const,
    },
    {
      name: "IDNFinancials two-segment profile",
      url: "https://www.idnfinancials.com/pgeo/pt-pertamina-geothermal-energy-tbk",
      reason: "blocked_host_path" as const,
    },
    {
      name: "Marketchameleon overview hub",
      url: "https://marketchameleon.com/Overview/BBCA/Summary/",
      reason: "blocked_host_path" as const,
    },
    {
      name: "LinkedIn social host",
      url: "https://www.linkedin.com/pulse/reclaiming-bca-billion-dollar-idea-mistake-leigh-mckiernon-ppdnc",
      reason: "blocked_host" as const,
    },
    {
      name: "MatrixBCG low-signal host",
      url: "https://matrixbcg.com/blogs/owners/bca",
      reason: "blocked_host" as const,
    },
    {
      name: "PDF extension",
      url: "https://www.bca.co.id/-/media/Feature/Report/File/Berita-Investor/2026/20260128-KI-Share-Buyback-EN.pdf",
      reason: "blocked_extension" as const,
    },
    {
      name: "XML extension",
      url: "https://www.dbs.com.sg/treasures/aics/templatedata/article/equity/data/en/DBSV/012014/BBCA_IJ.xml",
      reason: "blocked_extension" as const,
    },
    {
      name: "Tag listing path",
      url: "https://6abc.com/tag/baby/",
      reason: "blocked_path" as const,
    },
    {
      name: "Investor-relations listing suffix",
      url: "https://www.alphaspread.com/security/idx/bbca/investor-relations",
      reason: "blocked_path" as const,
    },
    {
      name: "Press-release listing suffix",
      url: "https://www.pge.pertamina.com/en/press-release",
      reason: "blocked_path" as const,
    },
  ])("CSV-derived block: $name", ({ url, reason }) => {
    const decision = classifyNoisyUrl(url);

    expect(decision.blocked).toBe(true);
    if (decision.blocked) {
      expect(decision.reason).toBe(reason);
    }
  });

  it.each([
    {
      name: "Yahoo Finance news article",
      url: "https://finance.yahoo.com/news/bbva-kkr-form-climate-focused-060544867.html",
    },
    {
      name: "Investing.com news article",
      url: "https://www.investing.com/news/stock-market-news/bbva-expands-openai-partnership-gives-chatgpt-access-to-120000-staff-93CH-4405130",
    },
    {
      name: "Marketscreener news article",
      url: "https://www.marketscreener.com/news/pt-bank-central-asia-tbk-9m-2025-performance-result-prudent-business-growth-drives-bca-results-ce7d5ad3d98df126",
    },
    {
      name: "Marketscreener quote hub with news story slug",
      url: "https://www.marketscreener.com/quote/stock/PT-PERTAMINA-GEOTHERMAL-E-151016431/news/PT-Pertamina-Geothermal-Energy-Tbk-Announces-Board-Changes-46879522/",
    },
    {
      name: "Tempo read article",
      url: "https://en.tempo.co/read/2083671/bca-to-buyback-rp5-trillion-in-shares",
    },
    {
      name: "Reuters world article",
      url: "https://www.reuters.com/world/asia-pacific/sample-story-2026-01-01/",
    },
    {
      name: "PR Newswire release",
      url: "https://www.prnewswire.com/news-releases/bbva-deepens-partnership-with-google-cloud-to-innovate-with-ai-302496060.html",
    },
    {
      name: "Single press release with slug",
      url: "https://www.pge.pertamina.com/en/press-release/pge-posts-us318-86-million-in-revenue-through-q3-2025-with-additional-capacity-at-lumut-balai-unit-2-a-key-driver",
    },
    {
      name: "Global Renewable News article path",
      url: "https://globalrenewablenews.com/article/energy/category/generation/52/1167990/pge-demonstrates-digital-transformation-boosts-national-geothermal-efficiency-and-competitiveness.html",
    },
    {
      name: "Fitch research article-style path",
      url: "https://www.fitchratings.com/research/banks/pt-bank-central-asia-tbk-update-19-11-2025",
    },
  ])("CSV-derived allow: $name", ({ url }) => {
    const decision = classifyNoisyUrl(url);

    expect(decision.blocked).toBe(false);
    if (!decision.blocked) {
      expect(decision.canonicalUrl).toMatch(/^https:\/\//);
    }
  });

  it.each([
    {
      name: "Statista statistics page",
      url: "https://www.statista.com/statistics/271639/coffee-consumption-worldwide/",
    },
    {
      name: "Statista consent-wall root",
      url: "https://www.statista.com/",
    },
    {
      name: "Precedence Research market-size page",
      url: "https://www.precedenceresearch.com/coffee-market",
    },
    {
      name: "Grand View Research report",
      url: "https://www.grandviewresearch.com/industry-analysis/coffee-market",
    },
    {
      name: "MarketsandMarkets report",
      url: "https://www.marketsandmarkets.com/Market-Reports/coffee-market-259114694.html",
    },
    {
      name: "Market-research host with a news-shaped path (host block wins)",
      url: "https://www.mordorintelligence.com/news/coffee-market-update",
    },
  ])("low-value source block: $name", ({ url }) => {
    const decision = classifyNoisyUrl(url);

    expect(decision.blocked).toBe(true);
    if (decision.blocked) {
      expect(decision.reason).toBe("low_value_source");
    }
  });

  it("does not block a legitimate news story that merely mentions market size", () => {
    const decision = classifyNoisyUrl(
      "https://www.reuters.com/business/coffee-prices-hit-record-2026-07-14/",
    );

    expect(decision.blocked).toBe(false);
  });
});

describe("classifyNoisyUrl: non-article pages seen in collected data", () => {
  it.each([
    { name: "Bare domain", url: "https://cloudin.asia" },
    { name: "Bare domain with www", url: "https://www.indotelko.com" },
    { name: "Bare domain, country TLD", url: "https://dnb.co.id" },
    {
      name: "Bare domain with trailing slash",
      url: "https://www.siberindo.io/",
    },
    { name: "Homepage under a locale path", url: "https://ioh.co.id/EN/home" },
    { name: "Section index segment", url: "https://example.com/berita/index" },
  ])("site homepage: $name", ({ url }) => {
    const decision = classifyNoisyUrl(url);

    expect(decision.blocked).toBe(true);
    if (decision.blocked) {
      expect(decision.reason).toBe("site_homepage");
    }
  });

  it.each([
    {
      name: "Generated ticker comparison page",
      url: "https://pluang.com/en/compare/fore-idss-vs-pskt-idss",
    },
    {
      name: "Generated ticker comparison page, other pair",
      url: "https://pluang.com/en/compare/masb-idss-vs-tlkm-idss",
    },
    {
      name: "Academic author profile",
      url: "https://www.researchgate.net/profile/Fitri-Kartiasih",
    },
    {
      name: "Dividend data page",
      url: "https://stockinvest.us/dividends/TLK",
    },
  ])("non-article page: $name", ({ url }) => {
    const decision = classifyNoisyUrl(url);

    expect(decision.blocked).toBe(true);
    if (decision.blocked) {
      expect(decision.reason).toBe("non_article_page");
    }
  });

  it("blocks the plural company-profiles path exchanges use", () => {
    const decision = classifyNoisyUrl(
      "https://www.idx.id/en/listed-companies/company-profiles/TLKM",
    );

    expect(decision.blocked).toBe(true);
  });

  it.each([
    {
      name: "Substack post",
      url: "https://neverlater.substack.com/p/teazzi-has-built-a-strong-presence",
    },
    {
      name: "News slug with id",
      url: "https://emitennews.com/news/ternyata-ini-alasan-fore-belum-bagi-dividen-meski-omset-naik-5172",
    },
    {
      name: "Indonesian news portal",
      url: "https://www.antaranews.com/berita/5657688/konektivitas-berbasis-ai-asia-pasifik",
    },
    {
      name: "Analysis slug",
      url: "https://katadata.co.id/analisisdata/6a58a56fde9d7/transformasi-tlkm-30",
    },
    {
      name: "Read path with numeric ids",
      url: "https://teknologi.bisnis.com/read/20260716/101/1988449/strategi-perampingan-telkom-tlkm",
    },
    {
      name: "Research report slug",
      url: "https://www.brights.id/en/research-and-news/research-report/telkom-indonesia-tlkmij-rp-2520-buy",
    },
    {
      name: "Market trend slug",
      url: "https://www.trenasia.id/tren-pasar/saham-tlkm-masih-murah-asing-borong-saat-pasar-berdarah",
    },
  ])("keeps a real article: $name", ({ url }) => {
    const decision = classifyNoisyUrl(url);

    expect(decision.blocked).toBe(false);
  });
});

describe("classifyNoisyUrl: reference and market-data pages", () => {
  it.each([
    {
      name: "Wikipedia article in any language",
      url: "https://ms.wikipedia.org/wiki/Antigua_dan_Barbuda",
    },
    {
      name: "English Wikipedia",
      url: "https://en.wikipedia.org/wiki/Telkom_Indonesia",
    },
    {
      name: "Britannica entry",
      url: "https://www.britannica.com/money/telecommunications",
    },
  ])("encyclopedia source: $name", ({ url }) => {
    const decision = classifyNoisyUrl(url);

    expect(decision.blocked).toBe(true);
    if (decision.blocked) {
      expect(decision.reason).toBe("low_value_source");
    }
  });

  it.each([
    {
      name: "Broker research ratings page",
      url: "https://www.barrons.com/market-data/stocks/tlkm/research-ratings?countrycode=id",
    },
    {
      name: "Financials tab",
      url: "https://example.com/stocks/tlkm/financials",
    },
    {
      name: "Balance sheet tab",
      url: "https://example.com/stocks/tlkm/balance-sheet",
    },
  ])("market-data page: $name", ({ url }) => {
    const decision = classifyNoisyUrl(url);

    expect(decision.blocked).toBe(true);
    if (decision.blocked) {
      expect(decision.reason).toBe("non_article_page");
    }
  });

  it("keeps a news story about company earnings", () => {
    const decision = classifyNoisyUrl(
      "https://www.trenasia.id/tren-pasar/saham-tlkm-masih-murah-asing-borong-saat-pasar-berdarah",
    );

    expect(decision.blocked).toBe(false);
  });
});
