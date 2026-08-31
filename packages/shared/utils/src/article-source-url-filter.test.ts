/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  canonicalizeUrl,
  classifyNoisyUrl,
  isUnresolvableAggregatorUrl,
  unwrapRedirectUrl,
} from "./article-source-url-filter.js";

describe("canonicalizeUrl", () => {
  it("collapses a paginated article's pages onto one canonical URL", () => {
    const base =
      "https://market.bisnis.com/read/20260825/192/1998715/intip-mesin-pertumbuhan-dcii";

    expect(canonicalizeUrl(base)).toBe(base);
    expect(canonicalizeUrl(`${base}/2`)).toBe(base);
    expect(canonicalizeUrl(`${base}/All`)).toBe(base);
  });

  it("leaves trailing numeric segments alone on hosts that do not paginate articles", () => {
    const url = "https://www.cnbcindonesia.com/market/2026/top-5-emiten/3";

    expect(canonicalizeUrl(url)).toBe(url);
  });

  it("keeps a paginating host's non-article paths intact", () => {
    const url = "https://market.bisnis.com/topic/2026";

    expect(canonicalizeUrl(url)).toBe(url);
  });

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

describe("unwrapRedirectUrl", () => {
  it("returns the destination carried in a wrapper's query parameter", () => {
    expect(
      unwrapRedirectUrl(
        "https://www.google.com/url?url=https%3A%2F%2Finvestasi.kontan.co.id%2Fnews%2Fantm-tumbuh&sa=U",
      ),
    ).toBe("https://investasi.kontan.co.id/news/antm-tumbuh");
    expect(
      unwrapRedirectUrl(
        "https://l.facebook.com/l.php?u=https%3A%2F%2Fmarket.bisnis.com%2Fread%2F123",
      ),
    ).toBe("https://market.bisnis.com/read/123");
  });

  it("reports a wrapper whose target is an opaque token", () => {
    expect(
      unwrapRedirectUrl(
        "https://www.google.com/goto?url=CAESowEB7keqTSju73L9dBqD1fIziKyLcRRpR23ut3rq",
      ),
    ).toBe("opaque");
  });

  it("returns undefined for an ordinary article URL", () => {
    expect(
      unwrapRedirectUrl("https://investasi.kontan.co.id/news/antm-tumbuh"),
    ).toBeUndefined();
    expect(unwrapRedirectUrl("not-a-url")).toBeUndefined();
  });

  it("ignores a non-http destination", () => {
    expect(
      unwrapRedirectUrl("https://www.google.com/url?url=javascript%3Aalert(1)"),
    ).toBe("opaque");
  });
});

describe("classifyNoisyUrl: redirect wrappers", () => {
  it("classifies the publisher URL a wrapper points at, not the wrapper", () => {
    const decision = classifyNoisyUrl(
      "https://www.google.com/url?url=https%3A%2F%2Finvestasi.kontan.co.id%2Fnews%2Fantm-tumbuh",
    );

    expect(decision).toEqual({
      blocked: false,
      canonicalUrl: "https://investasi.kontan.co.id/news/antm-tumbuh",
    });
  });

  it("applies host rules to the unwrapped destination", () => {
    const decision = classifyNoisyUrl(
      "https://www.google.com/url?url=https%3A%2F%2Fwww.statista.com%2Fstatistics%2F123%2Fcoal",
    );

    expect(decision).toMatchObject({
      blocked: true,
      reason: "low_value_source",
    });
  });

  it("drops a wrapper whose destination cannot be recovered", () => {
    const decision = classifyNoisyUrl(
      "https://www.google.com/goto?url=CAESowEB7keqTSju73L9dBqD1fIziKyLcRRpR23ut3rq",
    );

    expect(decision).toMatchObject({
      blocked: true,
      reason: "opaque_redirect",
    });
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
      reason: "low_value_source" as const,
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
      name: "MSN syndicated news article",
      url: "https://www.msn.com/id-id/berita/other/bank-digital-tak-rem-laju-kredit/ar-AA28",
      reason: "blocked_host" as const,
    },
    {
      name: "MSN stock details",
      url: "https://www.msn.com/en-us/money/stockdetails/bbca-id-stock/fi-bn91jc",
      reason: "blocked_host" as const,
    },
    {
      name: "Vietnam.vn translated article",
      url: "https://www.vietnam.vn/id/thi-truong-ban-le-dong-gop-tich-cuc-vao-su-phat-trien",
      reason: "blocked_host" as const,
    },
    {
      name: "AchmadNurHidayat.ID syndication mirror",
      url: "https://achmadnurhidayat.id/saham-bri-melonjak-pembelian-asing",
      reason: "blocked_host" as const,
    },
    {
      name: "MatrixBCG low-signal host",
      url: "https://matrixbcg.com/blogs/owners/bca",
      reason: "blocked_host" as const,
    },
    {
      name: "Qoo10 marketplace news mirror",
      url: "https://www.qoo10.co.id/bisnis/541497/jp-morgan-naikkan-target-saham-bbri-rp-3400",
      reason: "blocked_host" as const,
    },
    {
      name: "Qoo10 marketplace news mirror on a subdomain",
      url: "https://gadget.qoo10.co.id/bisnis/pembangkit-lirik-batu-bara-saat-minyak-naik-hormuz-tak-pasti",
      reason: "blocked_host" as const,
    },
    {
      name: "JournalArta generated technical page",
      url: "https://journalarta.com/news/2026/08/12/saham-amrt-menguat-0-72-death-cross-menekan-jadi-sorotan",
      reason: "low_value_source" as const,
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
    {
      name: "Algorithmic price-prediction page",
      url: "https://247wallst.com/companies/GRAB/price-prediction",
      reason: "blocked_path" as const,
    },
    {
      name: "Stock-forecast page",
      url: "https://example.com/companies/GRAB/stock-forecast",
      reason: "blocked_path" as const,
    },
    {
      name: "Price-target page",
      url: "https://example.com/stocks/BBCA/price-target",
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

  it.each([
    "https://rri.co.id/kupang/berita-foto/55673/bri-berkolaborasi-buka-ruang-pertumbuhan",
    "https://www.example.co.id/foto/2026/08/05/rapat-umum-pemegang-saham",
    "https://news.example.com/galeri/peresmian-pabrik-baru",
    "https://www.example.com/photo-news/annual-meeting-2026",
    "https://www.example.com/gallery/factory-opening",
  ])(
    "blocks a photo gallery, which carries a caption rather than an article: %s",
    (url) => {
      const decision = classifyNoisyUrl(url);

      expect(decision.blocked).toBe(true);
      if (decision.blocked) {
        expect(decision.reason).toBe("non_article_page");
      }
    },
  );

  it.each([
    "https://www.example.co.id/berita/fotografi-industri-kreatif-tumbuh-12-persen",
    "https://www.example.com/news/photography-market-grows",
  ])(
    "keeps an article whose slug merely starts with the same letters: %s",
    (url) => {
      const decision = classifyNoisyUrl(url);

      expect(decision.blocked).toBe(false);
    },
  );

  it("keeps a news story about company earnings", () => {
    const decision = classifyNoisyUrl(
      "https://www.trenasia.id/tren-pasar/saham-tlkm-masih-murah-asing-borong-saat-pasar-berdarah",
    );

    expect(decision.blocked).toBe(false);
  });
});

describe("classifyNoisyUrl: second-wave non-article sources", () => {
  it.each([
    {
      name: "TradingView, syndicated news included",
      url: "https://www.tradingview.com/news/kontan:3dd467df887ea:0",
    },
    {
      name: "ZoomInfo company record",
      url: "https://www.zoominfo.com/c/pt-telkom-indonesia-persero-tbk/345500426",
    },
    {
      name: "Tracxn company database",
      url: "https://tracxn.com/d/geographies/indonesia/__Gabk9o4",
    },
    {
      name: "Dealroom note",
      url: "https://app.dealroom.co/news/note/fore-coffee-taps-idr-337b-ipo",
    },
  ])("data platform blocked host-wide: $name", ({ url }) => {
    const decision = classifyNoisyUrl(url);

    expect(decision.blocked).toBe(true);
    if (decision.blocked) {
      expect(decision.reason).toBe("low_value_source");
    }
  });

  it("blocks the singular simplywall.st /stock/ path as well as /stocks/", () => {
    expect(
      classifyNoisyUrl("https://simplywall.st/stock/idx/tlkm").blocked,
    ).toBe(true);
    expect(
      classifyNoisyUrl("https://simplywall.st/stocks/idx/tlkm").blocked,
    ).toBe(true);
  });

  it("blocks a ResearchGate figure as well as a publication", () => {
    expect(
      classifyNoisyUrl(
        "https://www.researchgate.net/figure/5G-Coverage_fig4_370787573",
      ).blocked,
    ).toBe(true);
  });

  it.each([
    { name: "Section index", url: "https://www.worldcoffeeportal.com/news" },
    { name: "Indonesian section index", url: "https://example.com/berita" },
    { name: "Locale-only path", url: "https://www.kuehne-nagel.com/id" },
    { name: "Locale with region", url: "https://example.com/en-us" },
  ])("site homepage: $name", ({ url }) => {
    const decision = classifyNoisyUrl(url);

    expect(decision.blocked).toBe(true);
    if (decision.blocked) {
      expect(decision.reason).toBe("site_homepage");
    }
  });

  it.each([
    {
      name: "Paginated listing",
      url: "https://www.telkom.co.id/sites/berita/id_ID/page/news-about-telkom-122",
    },
    {
      name: "Marketing product page",
      url: "https://businessmodelcanvastemplate.com/products/fore-coffee-swot-analysis",
    },
  ])("non-article page: $name", ({ url }) => {
    expect(classifyNoisyUrl(url).blocked).toBe(true);
  });

  it.each([
    {
      name: "Story under a news section",
      url: "https://emitennews.com/news/ternyata-ini-alasan-fore-belum-bagi-dividen-5172",
    },
    {
      name: "Story under an Indonesian berita section",
      url: "https://www.antaranews.com/berita/5657688/konektivitas-berbasis-ai",
    },
    {
      name: "Hyphenated section that is not an index",
      url: "https://www.idxchannel.com/market-news/ekspansif-fore-buka-40-gerai",
    },
    {
      name: "Story under a locale prefix",
      url: "https://www.brights.id/en/research-and-news/research-report/telkom-indonesia",
    },
  ])("keeps a real article: $name", ({ url }) => {
    expect(classifyNoisyUrl(url).blocked).toBe(false);
  });
});

describe("classifyNoisyUrl: school domains", () => {
  it.each([
    {
      name: "School article path",
      url: "https://smkn2klaten.sch.id/berita/artikel/41/student-english-forum",
    },
    { name: "School root", url: "https://sman1jakarta.sch.id" },
  ])("blocks $name", ({ url }) => {
    const decision = classifyNoisyUrl(url);

    expect(decision.blocked).toBe(true);
    if (decision.blocked) {
      expect(decision.reason).toBe("blocked_host");
    }
  });

  it("does not block a publisher whose name merely contains sch", () => {
    expect(
      classifyNoisyUrl("https://www.schroders.com/en/insights/market-update")
        .blocked,
    ).toBe(false);
  });
});

describe("classifyNoisyUrl: vendor and directory pages", () => {
  it.each([
    {
      name: "Vendor technology page",
      url: "https://www.redhat.com/en/technologies/cloud-computing/connectivity-link",
    },
    {
      name: "Vendor solutions page",
      url: "https://example.com/solutions/networking",
    },
    {
      name: "Vendor platform page",
      url: "https://example.com/platform/overview",
    },
    {
      name: "Company directory entry",
      url: "https://www.indonesia-investments.com/business/indonesian-companies/telekomunikasi-indonesia/item201",
    },
    {
      name: "Exchange listed-companies directory",
      url: "https://example.com/en/listed-companies/TLKM",
    },
  ])("non-article page: $name", ({ url }) => {
    const decision = classifyNoisyUrl(url);

    expect(decision.blocked).toBe(true);
    if (decision.blocked) {
      expect(decision.reason).toBe("non_article_page");
    }
  });

  it.each([
    {
      name: "Press release listing with a pagination query",
      url: "https://asean.newsroom.ibm.com/press-releases?l=50",
    },
    { name: "Newsroom index", url: "https://example.com/newsroom" },
    {
      name: "Indonesian press release index",
      url: "https://example.com/siaran-pers",
    },
  ])("site homepage: $name", ({ url }) => {
    const decision = classifyNoisyUrl(url);

    expect(decision.blocked).toBe(true);
    if (decision.blocked) {
      expect(decision.reason).toBe("site_homepage");
    }
  });

  it.each([
    {
      name: "Story under a companies section",
      url: "https://example.com/business/companies/telkom-lands-subsea-cable",
    },
    {
      name: "Headline containing the word companies",
      url: "https://example.com/news/top-companies-to-watch-2026",
    },
    {
      name: "Story under a newsroom section",
      url: "https://example.com/newsroom/telkom-perkuat-konektivitas-digital",
    },
    {
      name: "Story under a press-releases section",
      url: "https://example.com/press-releases/nacsa-mcmc-ibm-partnership",
    },
  ])("keeps a real article: $name", ({ url }) => {
    expect(classifyNoisyUrl(url).blocked).toBe(false);
  });
});

describe("classifyNoisyUrl: Indonesian section pages and pagination", () => {
  it("blocks a rubrik section listing", () => {
    expect(classifyNoisyUrl("https://selular.id/rubrik/telkom").blocked).toBe(
      true,
    );
  });

  it("blocks a rubrik sub-section even though the path contains /news/", () => {
    const decision = classifyNoisyUrl("https://selular.id/rubrik/news/feature");

    expect(decision.blocked).toBe(true);
    if (decision.blocked) {
      expect(decision.reason).toBe("site_homepage");
    }
  });

  it("blocks a broker stock-price page", () => {
    expect(
      classifyNoisyUrl("https://ajaib.co.id/saham/aset/TLKM").blocked,
    ).toBe(true);
  });

  it("blocks a paginated continuation of an article", () => {
    expect(
      classifyNoisyUrl(
        "https://www.bloombergtechnoz.com/detail-news/115056/tlkm-diborong-asing-di-tengah-transformasi-bisnis/2",
      ).blocked,
    ).toBe(true);
  });

  it.each([
    {
      name: "First page of the same article",
      url: "https://www.bloombergtechnoz.com/detail-news/115056/tlkm-diborong-asing-di-tengah-transformasi-bisnis",
    },
    {
      name: "Article whose path ends in a long numeric id",
      url: "https://investor.id/business/447241/pendaratan-kabel-nongsachangi-dorong-kemitraan",
    },
    {
      name: "Article under a saham section",
      url: "https://www.liputan6.com/saham/read/8250770/fore-bukukan-laba-bersih-semester-i-2026",
    },
    {
      name: "Selular article at its dated permalink",
      url: "https://selular.id/2026/07/telkomgroup-perkuat-gerbang-digital-lewat-kabel-laut-ncc",
    },
  ])("keeps a real article: $name", ({ url }) => {
    expect(classifyNoisyUrl(url).blocked).toBe(false);
  });
});

describe("classifyNoisyUrl: recruitment listings and image galleries", () => {
  it("blocks a job listing a publisher files under its news section", () => {
    const result = classifyNoisyUrl(
      "https://sulbar.tribunnews.com/news/81692/lowongan-kerja-muf-agustus-2026-dibuka-tersedia-300-lebih-posisi",
    );

    expect(result.blocked).toBe(true);
    expect(result.blocked && result.reason).toBe("non_editorial_page");
  });

  it("blocks a job listing outside a news path", () => {
    const result = classifyNoisyUrl(
      "https://banjarmasin.tribunnews.com/kalsel/1371436/lowongan-kerja-adaro-group-penempatan-di-tanahlaut-kalsel",
    );

    expect(result.blocked).toBe(true);
    expect(result.blocked && result.reason).toBe("non_editorial_page");
  });

  it("blocks a careers page", () => {
    expect(
      classifyNoisyUrl("https://example.co.id/karier/analyst").blocked,
    ).toBe(true);
    expect(
      classifyNoisyUrl("https://example.com/careers/analyst").blocked,
    ).toBe(true);
  });

  it("blocks an image gallery path", () => {
    const result = classifyNoisyUrl(
      "https://money.kompas.com/image/2026/08/06/090100626/airlangga-dorong-investasi-china",
    );

    expect(result.blocked).toBe(true);
    expect(result.blocked && result.reason).toBe("non_article_page");
  });

  it("blocks a workforce-data vendor page", () => {
    const result = classifyNoisyUrl(
      "https://www.reveliolabs.com/companies/soho-global-health/employees",
    );

    expect(result.blocked).toBe(true);
    expect(result.blocked && result.reason).toBe("low_value_source");
  });

  it("keeps a story that merely reports on hiring", () => {
    const result = classifyNoisyUrl(
      "https://market.bisnis.com/read/20260810/192/1993592/bank-mandiri-tambah-3-000-karyawan-tahun-ini",
    );

    expect(result.blocked).toBe(false);
  });
});

describe("isUnresolvableAggregatorUrl", () => {
  it("flags a Google News RSS article link", () => {
    expect(
      isUnresolvableAggregatorUrl(
        "https://news.google.com/rss/articles/CBMiuwFBVV95cUxOR3Jkb0V6REY3RVVrb0c4bkM1S3Zj?oc=5",
      ),
    ).toBe(true);
  });

  it("leaves a publisher article alone", () => {
    expect(
      isUnresolvableAggregatorUrl(
        "https://keuangan.kontan.co.id/news/pembiayaan-emas-bca-syariah-melonjak-1276-hingga-juni-2026",
      ),
    ).toBe(false);
  });

  it("leaves a Google News section page alone", () => {
    expect(
      isUnresolvableAggregatorUrl("https://news.google.com/topics/CAAqIQgKIhs"),
    ).toBe(false);
  });

  it("treats an unparseable url as resolvable, leaving it to the other rules", () => {
    expect(isUnresolvableAggregatorUrl("not-a-url")).toBe(false);
  });
});
