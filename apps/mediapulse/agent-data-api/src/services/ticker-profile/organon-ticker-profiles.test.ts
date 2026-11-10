import { describe, expect, it, vi } from "vitest";

import {
  MAX_SPARQL_QUERY_LENGTH,
  type SparqlBinding,
} from "@mediapulse/knowledge-graph";

import {
  COMPANY_FACTS_QUERY,
  LINKED_PARTIES_QUERY,
  MARKET_CONTEXT_QUERY,
  compareText,
  loadOrganonTickerProfiles,
  mapOrganonTickerProfiles,
} from "./organon-ticker-profiles.js";

const MP = "https://mediapulse.hyperjump.tech/ontology#";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const ALTERNATIVE = "http://purl.org/dc/terms/alternative";

const fact = (
  ticker: string,
  property: string,
  value: string,
  language?: string,
): SparqlBinding => ({
  ticker: { type: "literal", value: ticker },
  property: { type: "uri", value: property },
  value: {
    type: "literal",
    value,
    ...(language === undefined ? {} : { "xml:lang": language }),
  },
});

const party = (
  ticker: string,
  relation: string,
  iri: string,
  name: string,
  extra: {
    partyTicker?: string;
    partyAlias?: string;
    partyAmbiguousName?: string;
  } = {},
): SparqlBinding => ({
  ticker: { type: "literal", value: ticker },
  relation: { type: "uri", value: `${MP}${relation}` },
  party: { type: "uri", value: iri },
  partyName: { type: "literal", value: name },
  ...(extra.partyTicker === undefined
    ? {}
    : { partyTicker: { type: "literal", value: extra.partyTicker } }),
  ...(extra.partyAlias === undefined
    ? {}
    : { partyAlias: { type: "literal", value: extra.partyAlias } }),
  ...(extra.partyAmbiguousName === undefined
    ? {}
    : {
        partyAmbiguousName: {
          type: "literal",
          value: extra.partyAmbiguousName,
        },
      }),
});

const marketRow = (
  ticker: string,
  relation: string,
  iri: string,
  name: string,
  extra: Partial<
    Record<"itemNameId" | "description" | "status" | "issuer", string>
  > = {},
): SparqlBinding => ({
  ticker: { type: "literal", value: ticker },
  relation: { type: "uri", value: `${MP}${relation}` },
  item: { type: "uri", value: iri },
  itemName: { type: "literal", value: name },
  ...Object.fromEntries(
    Object.entries(extra).map(([key, value]) => [
      key,
      key === "status"
        ? { type: "uri", value: `${MP}${value}` }
        : { type: "literal", value },
    ]),
  ),
});

const classificationFacts = (ticker: string): SparqlBinding[] => [
  fact(ticker, `${MP}companyOverview`, "Overview in English.", "en"),
  fact(ticker, `${MP}businessOperation`, "Operation in English.", "en"),
  fact(
    ticker,
    `${MP}companyOverview`,
    "Ikhtisar dalam bahasa Indonesia.",
    "id",
  ),
  fact(
    ticker,
    `${MP}businessOperation`,
    "Operasi dalam bahasa Indonesia.",
    "id",
  ),
  fact(ticker, `${MP}sector`, "Consumer Cyclicals", "en"),
  fact(ticker, `${MP}sector`, "Barang Konsumen Primer", "id"),
  fact(ticker, `${MP}subSector`, "Restaurants", "en"),
  fact(ticker, `${MP}subSector`, "Restoran", "id"),
  fact(ticker, `${MP}industry`, "Cafes", "en"),
  fact(ticker, `${MP}industry`, "Kafe", "id"),
  fact(ticker, `${MP}subIndustry`, "Coffee Chains", "en"),
  fact(ticker, `${MP}subIndustry`, "Jaringan Kedai Kopi", "id"),
];

describe("mapOrganonTickerProfiles", () => {
  it("maps text fields by language and builds aliases from names, brands and subsidiaries", () => {
    const facts = [
      ...classificationFacts("MAPB"),
      fact("MAPB", RDFS_LABEL, "Map Boga Adiperkasa"),
      fact("MAPB", `${MP}legalName`, "PT Map Boga Adiperkasa Tbk"),
      fact("MAPB", ALTERNATIVE, "MBA"),
      fact("MAPB", ALTERNATIVE, "Map Boga"),
    ];
    const parties = [
      party("MAPB", "operatesBrand", "brand:starbucks", "Starbucks", {
        partyAlias: "Starbucks Indonesia",
      }),
      party("MAPB", "operatesBrand", "brand:krispy", "Krispy Kreme"),
      party("MAPB", "parentOf", "company:sari", "Sari Coffee Indonesia", {
        partyTicker: "SARI",
      }),
    ];

    const profile = mapOrganonTickerProfiles(facts, parties).get("MAPB");

    expect(profile).toEqual({
      companyOverview: "Overview in English.",
      businessOperation: "Operation in English.",
      companyOverviewIndonesian: "Ikhtisar dalam bahasa Indonesia.",
      businessOperationIndonesian: "Operasi dalam bahasa Indonesia.",
      sectorIndonesian: "Barang Konsumen Primer",
      sectorEnglish: "Consumer Cyclicals",
      subSectorIndonesian: "Restoran",
      subSectorEnglish: "Restaurants",
      industryIndonesian: "Kafe",
      industryEnglish: "Cafes",
      subIndustryIndonesian: "Jaringan Kedai Kopi",
      subIndustryEnglish: "Coffee Chains",
      aliases: [
        "MAPB",
        "Map Boga Adiperkasa",
        "PT Map Boga Adiperkasa Tbk",
        "Map Boga",
        "MBA",
        "Krispy Kreme",
        "Starbucks",
        "Starbucks Indonesia",
        "Sari Coffee Indonesia",
      ],
      names: [
        "Map Boga Adiperkasa",
        "PT Map Boga Adiperkasa Tbk",
        "Map Boga",
        "MBA",
      ],
      brands: ["Krispy Kreme", "Starbucks"],
      subsidiaries: ["Sari Coffee Indonesia"],
      ambiguousNames: [],
      competitors: [],
      regulators: [],
      commodities: [],
      regulations: [],
    });
  });

  it("collects the ambiguous names of the company and of its brands", () => {
    const facts = [
      fact("SMAR", RDFS_LABEL, "Sinar Mas Agro Resources and Technology"),
      fact("SMAR", `${MP}ambiguousName`, "SMART"),
    ];
    const parties = [
      party("SMAR", "operatesBrand", "brand:mitra", "Mitra", {
        partyAmbiguousName: "Mitra",
      }),
      party("SMAR", "operatesBrand", "brand:filma", "Filma"),
    ];

    const profile = mapOrganonTickerProfiles(facts, parties).get("SMAR");

    expect(profile?.ambiguousNames).toEqual(["SMART", "Mitra"]);
    expect(profile?.brands).toEqual(["Filma", "Mitra"]);
  });

  it("lists produced commodities before inputs and the most specific regulations first, leaving out revoked ones", () => {
    const facts = [
      fact("AADI", RDFS_LABEL, "Adaro Andalan Indonesia"),
      fact("ITMG", RDFS_LABEL, "Indo Tambangraya Megah"),
    ];
    const market = [
      marketRow("AADI", "usesCommodity", `${MP}CommodityDiesel`, "Diesel"),
      marketRow("AADI", "producesCommodity", `${MP}CommodityCoal`, "Coal", {
        itemNameId: "Batu bara",
      }),
      marketRow("AADI", "boundBy", "rule:dhe", "PP 8/2025 (DHE SDA)", {
        description: "Export proceeds retention.",
        status: "RegulationStatusInForce",
        issuer: "BI",
      }),
      marketRow("ITMG", "boundBy", "rule:dhe", "PP 8/2025 (DHE SDA)", {
        status: "RegulationStatusInForce",
      }),
      marketRow("AADI", "boundBy", "rule:dmo", "Kepmen ESDM 399.K/2023", {
        description: "Domestic market obligation for coal.",
        status: "RegulationStatusInForce",
        issuer: "ESDM",
      }),
      marketRow("AADI", "boundBy", "rule:old", "Permen ESDM 10/2023", {
        status: "RegulationStatusRevoked",
        issuer: "ESDM",
      }),
    ];

    const profile = mapOrganonTickerProfiles(facts, [], market).get("AADI");

    expect(profile?.commodities).toEqual([
      { name: "Coal", nameIndonesian: "Batu bara", relation: "produces" },
      { name: "Diesel", nameIndonesian: "", relation: "uses" },
    ]);
    expect(profile?.regulations).toEqual([
      {
        name: "Kepmen ESDM 399.K/2023",
        description: "Domestic market obligation for coal.",
        issuer: "ESDM",
        status: "in force",
      },
      {
        name: "PP 8/2025 (DHE SDA)",
        description: "Export proceeds retention.",
        issuer: "BI",
        status: "in force",
      },
    ]);
  });

  it("uses empty text for a missing value and drops repeated aliases ignoring case", () => {
    const facts = [
      fact("FORE", RDFS_LABEL, "Fore Kopi Indonesia"),
      fact("FORE", ALTERNATIVE, "fore kopi indonesia"),
      fact("FORE", ALTERNATIVE, "Fore Coffee"),
    ];

    const profile = mapOrganonTickerProfiles(facts, []).get("FORE");

    expect(profile?.companyOverview).toBe("");
    expect(profile?.companyOverviewIndonesian).toBe("");
    expect(profile?.sectorIndonesian).toBe("");
    expect(profile?.aliases).toEqual([
      "FORE",
      "Fore Kopi Indonesia",
      "Fore Coffee",
    ]);
  });

  it("orders competitors primary first, then by how many issuers list them, and adds their ticker as an alias", () => {
    const facts = ["FORE", "KOPI", "TEAS"].flatMap(classificationFacts);
    const parties = [
      party("FORE", "competesWith", "company:mapb", "Map Boga Adiperkasa", {
        partyTicker: "MAPB",
        partyAlias: "MBA",
      }),
      party("FORE", "competesWith", "brand:kenangan", "Kopi Kenangan"),
      party("FORE", "competesWith", "brand:tomoro", "Tomoro Coffee"),
      party("FORE", "competesWith", "company:fore", "Fore Kopi Indonesia", {
        partyTicker: "FORE",
      }),
      party("FORE", "primaryCompetitor", "brand:tomoro", "Tomoro Coffee"),
      party("KOPI", "competesWith", "brand:kenangan", "Kopi Kenangan"),
      party("TEAS", "competesWith", "brand:kenangan", "Kopi Kenangan"),
      party("TEAS", "competesWith", "company:mapb", "Map Boga Adiperkasa", {
        partyTicker: "MAPB",
      }),
    ];

    const competitors = mapOrganonTickerProfiles(facts, parties).get(
      "FORE",
    )?.competitors;

    expect(competitors).toEqual([
      { name: "Tomoro Coffee", aliases: [] },
      { name: "Kopi Kenangan", aliases: [] },
      { name: "Map Boga Adiperkasa", aliases: ["MAPB", "MBA"] },
    ]);
  });

  it("orders regulators from the most specific to the one that covers every issuer", () => {
    const facts = ["FORE", "BBCA"].flatMap(classificationFacts);
    const parties = [
      party("FORE", "regulatedBy", "regulator:ojk", "OJK", {
        partyAlias: "Otoritas Jasa Keuangan",
      }),
      party("FORE", "regulatedBy", "regulator:ojk", "OJK", {
        partyAlias: "Financial Services Authority",
      }),
      party("FORE", "regulatedBy", "regulator:bpom", "BPOM"),
      party("BBCA", "regulatedBy", "regulator:ojk", "OJK"),
    ];

    const regulators = mapOrganonTickerProfiles(facts, parties).get(
      "FORE",
    )?.regulators;

    expect(regulators).toEqual([
      { name: "BPOM", aliases: [] },
      {
        name: "OJK",
        aliases: ["Financial Services Authority", "Otoritas Jasa Keuangan"],
      },
    ]);
  });

  it("gives the same profile when Organon returns the rows in another order", () => {
    const facts = ["FORE", "KOPI"].flatMap(classificationFacts);
    const parties = [
      party("FORE", "competesWith", "brand:a", "Alpha Coffee"),
      party("FORE", "competesWith", "brand:b", "Beta Coffee"),
      party("KOPI", "competesWith", "brand:b", "Beta Coffee"),
      party("FORE", "regulatedBy", "regulator:bpom", "BPOM"),
    ];

    const forward = mapOrganonTickerProfiles(facts, parties).get("FORE");
    const reversed = mapOrganonTickerProfiles(
      [...facts].reverse(),
      [...parties].reverse(),
    ).get("FORE");

    expect(reversed).toEqual(forward);
  });

  it("leaves out a ticker that only has party rows", () => {
    const parties = [party("GHOST", "competesWith", "brand:a", "Alpha Coffee")];

    expect(mapOrganonTickerProfiles([], parties).has("GHOST")).toBe(false);
  });
});

describe("loadOrganonTickerProfiles", () => {
  it("runs every query and maps their rows", async () => {
    const runSparql = vi.fn(async (query: string) =>
      query === COMPANY_FACTS_QUERY
        ? classificationFacts("MAPB")
        : query === LINKED_PARTIES_QUERY
          ? [party("MAPB", "regulatedBy", "regulator:ojk", "OJK")]
          : [],
    );

    const profiles = await loadOrganonTickerProfiles(runSparql);

    expect(runSparql).toHaveBeenCalledTimes(3);
    expect(profiles.get("MAPB")?.regulators).toEqual([
      { name: "OJK", aliases: [] },
    ]);
  });

  it("fails when Organon returns no profile at all", async () => {
    await expect(loadOrganonTickerProfiles(async () => [])).rejects.toThrow(
      "Organon returned no ticker profiles",
    );
  });

  it("keeps every query under Organon's length limit and loads every ticker", () => {
    for (const query of [
      COMPANY_FACTS_QUERY,
      LINKED_PARTIES_QUERY,
      MARKET_CONTEXT_QUERY,
    ]) {
      expect(query.length).toBeLessThan(MAX_SPARQL_QUERY_LENGTH);
      expect(query).not.toContain("VALUES ?ticker");
    }
  });
});

describe("compareText", () => {
  it("compares ignoring case first and then by the raw text", () => {
    const sorted = ["beta", "Alpha", "alpha", "Beta"].sort(compareText);

    expect(sorted).toEqual(["Alpha", "alpha", "Beta", "beta"]);
  });
});
