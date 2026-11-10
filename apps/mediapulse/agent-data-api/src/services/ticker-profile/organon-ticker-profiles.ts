import type {
  RunSparqlSelect,
  SparqlBinding,
} from "@mediapulse/knowledge-graph";
import type {
  TickerProfileCommodity,
  TickerProfileRegulation,
} from "@workspace/agent-data-api-contract";

import type { ProfileParty } from "../ticker-profile-parties.js";
import type { TickerProfileRecord } from "./ticker-profile-source.js";

const MP = "https://mediapulse.hyperjump.tech/ontology#";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const DCTERMS_ALTERNATIVE = "http://purl.org/dc/terms/alternative";

const PREFIXES = `PREFIX mp: <${MP}>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX dcterms: <http://purl.org/dc/terms/>`;

export const COMPANY_FACTS_QUERY = `${PREFIXES}
SELECT ?ticker ?property ?value WHERE {
  ?company a mp:ListedCompany ; mp:ticker ?ticker .
  VALUES ?property { rdfs:label mp:legalName dcterms:alternative mp:ambiguousName mp:companyOverview mp:businessOperation mp:sector mp:subSector mp:industry mp:subIndustry }
  ?company ?property ?value .
}`;

export const LINKED_PARTIES_QUERY = `${PREFIXES}
SELECT ?ticker ?relation ?party ?partyName ?partyTicker ?partyAlias ?partyAmbiguousName WHERE {
  ?company a mp:ListedCompany ; mp:ticker ?ticker .
  VALUES ?relation { mp:competesWith mp:primaryCompetitor mp:regulatedBy mp:operatesBrand mp:parentOf }
  ?company ?relation ?party .
  ?party rdfs:label ?partyName .
  OPTIONAL { ?party mp:ticker ?partyTicker }
  OPTIONAL { ?party dcterms:alternative ?partyAlias }
  OPTIONAL { ?party mp:ambiguousName ?partyAmbiguousName }
}`;

export const MARKET_CONTEXT_QUERY = `${PREFIXES}
SELECT ?ticker ?relation ?item ?itemName ?itemNameId ?description ?status ?issuer WHERE {
  ?company a mp:ListedCompany ; mp:ticker ?ticker .
  {
    VALUES ?relation { mp:producesCommodity mp:usesCommodity }
    ?company ?relation ?item .
    ?item skos:prefLabel ?itemName .
    OPTIONAL { ?item skos:altLabel ?itemNameId FILTER(lang(?itemNameId) = "id") }
  } UNION {
    BIND(mp:boundBy AS ?relation)
    ?company mp:boundBy ?item .
    ?item rdfs:label ?itemName .
    OPTIONAL { ?item dcterms:description ?description }
    OPTIONAL { ?item mp:regulationStatus ?status }
    OPTIONAL { ?item mp:issuedBy/rdfs:label ?issuer }
  }
}`;

type LanguageValue = { value: string; language: string };

type IssuerFacts = Map<string, LanguageValue[]>;

type LinkedParty = {
  iri: string;
  name: string;
  ticker: string;
  aliases: Set<string>;
  ambiguousNames: Set<string>;
};

type IssuerParties = Map<string, Map<string, LinkedParty>>;

const COMMODITY_RELATIONS: Record<string, TickerProfileCommodity["relation"]> =
  {
    [`${MP}producesCommodity`]: "produces",
    [`${MP}usesCommodity`]: "uses",
  };

const BOUND_BY = `${MP}boundBy`;

const REGULATION_STATUSES: Record<string, string> = {
  [`${MP}RegulationStatusInForce`]: "in force",
  [`${MP}RegulationStatusIssued`]: "issued",
  [`${MP}RegulationStatusDraft`]: "draft",
};

type MarketRegulation = TickerProfileRegulation & { iri: string };

type IssuerMarket = {
  commodities: Map<string, TickerProfileCommodity>;
  regulations: Map<string, MarketRegulation>;
};

const RELATIONS = {
  competesWith: `${MP}competesWith`,
  primaryCompetitor: `${MP}primaryCompetitor`,
  regulatedBy: `${MP}regulatedBy`,
  operatesBrand: `${MP}operatesBrand`,
  parentOf: `${MP}parentOf`,
} as const;

export const compareText = (first: string, second: string): number => {
  const firstLower = first.toLowerCase();
  const secondLower = second.toLowerCase();
  if (firstLower !== secondLower) {
    return firstLower < secondLower ? -1 : 1;
  }
  if (first === second) {
    return 0;
  }

  return first < second ? -1 : 1;
};

const sortedText = (values: Iterable<string>): string[] =>
  [...values].sort(compareText);

const bindingValue = (binding: SparqlBinding, name: string): string =>
  binding[name]?.value.trim() ?? "";

const bindingLanguage = (binding: SparqlBinding, name: string): string =>
  (binding[name]?.["xml:lang"] ?? "").toLowerCase();

const groupFacts = (rows: SparqlBinding[]): Map<string, IssuerFacts> => {
  const byTicker = new Map<string, IssuerFacts>();
  for (const row of rows) {
    const ticker = bindingValue(row, "ticker").toUpperCase();
    const property = bindingValue(row, "property");
    const value = bindingValue(row, "value");
    if (ticker === "" || property === "" || value === "") {
      continue;
    }
    const facts = byTicker.get(ticker) ?? new Map<string, LanguageValue[]>();
    const values = facts.get(property) ?? [];
    values.push({ value, language: bindingLanguage(row, "value") });
    facts.set(property, values);
    byTicker.set(ticker, facts);
  }

  return byTicker;
};

const groupParties = (rows: SparqlBinding[]): Map<string, IssuerParties> => {
  const byTicker = new Map<string, IssuerParties>();
  for (const row of rows) {
    const ticker = bindingValue(row, "ticker").toUpperCase();
    const relation = bindingValue(row, "relation");
    const iri = bindingValue(row, "party");
    const name = bindingValue(row, "partyName");
    if (ticker === "" || relation === "" || iri === "" || name === "") {
      continue;
    }
    const relations =
      byTicker.get(ticker) ?? new Map<string, Map<string, LinkedParty>>();
    const parties = relations.get(relation) ?? new Map<string, LinkedParty>();
    const party = parties.get(iri) ?? {
      iri,
      name,
      ticker: "",
      aliases: new Set<string>(),
      ambiguousNames: new Set<string>(),
    };
    if (compareText(name, party.name) < 0) {
      party.name = name;
    }
    const partyTicker = bindingValue(row, "partyTicker").toUpperCase();
    if (
      partyTicker !== "" &&
      (party.ticker === "" || partyTicker < party.ticker)
    ) {
      party.ticker = partyTicker;
    }
    const alias = bindingValue(row, "partyAlias");
    if (alias !== "") {
      party.aliases.add(alias);
    }
    const ambiguousName = bindingValue(row, "partyAmbiguousName");
    if (ambiguousName !== "") {
      party.ambiguousNames.add(ambiguousName);
    }
    parties.set(iri, party);
    relations.set(relation, parties);
    byTicker.set(ticker, relations);
  }

  return byTicker;
};

const groupMarket = (rows: SparqlBinding[]): Map<string, IssuerMarket> => {
  const byTicker = new Map<string, IssuerMarket>();
  for (const row of rows) {
    const ticker = bindingValue(row, "ticker").toUpperCase();
    const relation = bindingValue(row, "relation");
    const iri = bindingValue(row, "item");
    const name = bindingValue(row, "itemName");
    if (ticker === "" || iri === "" || name === "") {
      continue;
    }
    const market = byTicker.get(ticker) ?? {
      commodities: new Map<string, TickerProfileCommodity>(),
      regulations: new Map<string, MarketRegulation>(),
    };
    const commodityRelation = COMMODITY_RELATIONS[relation];
    if (commodityRelation !== undefined) {
      const key = `${commodityRelation} ${iri}`;
      const existing = market.commodities.get(key);
      const nameIndonesian = bindingValue(row, "itemNameId");
      const keepsExistingName =
        existing !== undefined &&
        (nameIndonesian === "" ||
          (existing.nameIndonesian !== "" &&
            compareText(existing.nameIndonesian, nameIndonesian) <= 0));
      if (!keepsExistingName) {
        market.commodities.set(key, {
          name,
          nameIndonesian,
          relation: commodityRelation,
        });
      }
    }
    const status = REGULATION_STATUSES[bindingValue(row, "status")];
    if (relation === BOUND_BY && status !== undefined) {
      market.regulations.set(iri, {
        iri,
        name,
        description: bindingValue(row, "description"),
        issuer: bindingValue(row, "issuer"),
        status,
      });
    }
    byTicker.set(ticker, market);
  }

  return byTicker;
};

const countIssuersPerRegulation = (
  marketByTicker: Map<string, IssuerMarket>,
): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const market of marketByTicker.values()) {
    for (const iri of market.regulations.keys()) {
      counts.set(iri, (counts.get(iri) ?? 0) + 1);
    }
  }

  return counts;
};

const orderCommodities = (
  market: IssuerMarket | undefined,
): TickerProfileCommodity[] =>
  [...(market?.commodities.values() ?? [])].sort((first, second) => {
    if (first.relation !== second.relation) {
      return first.relation === "produces" ? -1 : 1;
    }

    return compareText(first.name, second.name);
  });

const orderRegulations = (
  market: IssuerMarket | undefined,
  regulationCoverage: Map<string, number>,
): TickerProfileRegulation[] =>
  [...(market?.regulations.values() ?? [])]
    .sort((first, second) => {
      const coverageOrder =
        (regulationCoverage.get(first.iri) ?? 0) -
        (regulationCoverage.get(second.iri) ?? 0);

      return coverageOrder !== 0
        ? coverageOrder
        : compareText(first.name, second.name);
    })
    .map(({ name, description, issuer, status }) => ({
      name,
      description,
      issuer,
      status,
    }));

const pickText = (
  facts: IssuerFacts,
  property: string,
  language: string,
): string => {
  const candidates = (facts.get(`${MP}${property}`) ?? [])
    .filter((entry) => entry.language === language)
    .map((entry) => entry.value);

  return sortedText(candidates)[0] ?? "";
};

const allValues = (facts: IssuerFacts, property: string): string[] =>
  sortedText(new Set((facts.get(property) ?? []).map((entry) => entry.value)));

const dedupeCaseInsensitive = (
  values: Iterable<string>,
  exclude: readonly string[] = [],
): string[] => {
  const seen = new Set(exclude.map((value) => value.toLowerCase()));
  const unique: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    const key = value.toLowerCase();
    if (value !== "" && !seen.has(key)) {
      seen.add(key);
      unique.push(value);
    }
  }

  return unique;
};

const partiesOf = (
  relations: IssuerParties | undefined,
  relation: string,
): LinkedParty[] => [...(relations?.get(relation)?.values() ?? [])];

const namesOfParties = (parties: LinkedParty[]): string[] =>
  [...parties]
    .sort((first, second) => compareText(first.name, second.name))
    .flatMap((party) => [party.name, ...sortedText(party.aliases)]);

const mergeByName = (parties: LinkedParty[]): LinkedParty[] => {
  const byName = new Map<string, LinkedParty>();
  for (const party of parties) {
    const key = party.name.toLowerCase();
    const existing = byName.get(key);
    if (existing === undefined) {
      byName.set(key, {
        ...party,
        aliases: new Set(party.aliases),
        ambiguousNames: new Set(party.ambiguousNames),
      });
      continue;
    }
    for (const alias of party.aliases) {
      existing.aliases.add(alias);
    }
    for (const ambiguousName of party.ambiguousNames) {
      existing.ambiguousNames.add(ambiguousName);
    }
    if (existing.ticker === "" && party.ticker !== "") {
      existing.ticker = party.ticker;
    }
  }

  return [...byName.values()];
};

const countIssuersPerParty = (
  partiesByTicker: Map<string, IssuerParties>,
  relation: string,
): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const relations of partiesByTicker.values()) {
    for (const iri of relations.get(relation)?.keys() ?? []) {
      counts.set(iri, (counts.get(iri) ?? 0) + 1);
    }
  }

  return counts;
};

const toProfileParty = (
  party: LinkedParty,
  leadingAliases: string[],
): ProfileParty => ({
  name: party.name,
  aliases: dedupeCaseInsensitive(
    [...leadingAliases, ...sortedText(party.aliases)],
    [party.name],
  ),
});

const orderCompetitors = (
  ticker: string,
  relations: IssuerParties | undefined,
  competitorDegree: Map<string, number>,
): ProfileParty[] => {
  const primary = new Set(
    partiesOf(relations, RELATIONS.primaryCompetitor).map((party) => party.iri),
  );
  const candidates = partiesOf(relations, RELATIONS.competesWith).filter(
    (party) => party.ticker !== ticker,
  );
  const ranked = [...candidates].sort((first, second) => {
    const primaryOrder =
      Number(primary.has(second.iri)) - Number(primary.has(first.iri));
    if (primaryOrder !== 0) {
      return primaryOrder;
    }
    const degreeOrder =
      (competitorDegree.get(second.iri) ?? 0) -
      (competitorDegree.get(first.iri) ?? 0);
    if (degreeOrder !== 0) {
      return degreeOrder;
    }
    const listedOrder =
      Number(second.ticker !== "") - Number(first.ticker !== "");
    if (listedOrder !== 0) {
      return listedOrder;
    }
    const nameOrder = compareText(first.name, second.name);

    return nameOrder !== 0
      ? nameOrder
      : compareText(first.ticker, second.ticker);
  });

  return mergeByName(ranked).map((party) =>
    toProfileParty(party, party.ticker === "" ? [] : [party.ticker]),
  );
};

const orderRegulators = (
  relations: IssuerParties | undefined,
  regulatorCoverage: Map<string, number>,
): ProfileParty[] => {
  const ranked = [...partiesOf(relations, RELATIONS.regulatedBy)].sort(
    (first, second) => {
      const coverageOrder =
        (regulatorCoverage.get(first.iri) ?? 0) -
        (regulatorCoverage.get(second.iri) ?? 0);

      return coverageOrder !== 0
        ? coverageOrder
        : compareText(first.name, second.name);
    },
  );

  return mergeByName(ranked).map((party) => toProfileParty(party, []));
};

export const mapOrganonTickerProfiles = (
  factRows: SparqlBinding[],
  partyRows: SparqlBinding[],
  marketRows: SparqlBinding[] = [],
): Map<string, TickerProfileRecord> => {
  const factsByTicker = groupFacts(factRows);
  const partiesByTicker = groupParties(partyRows);
  const marketByTicker = groupMarket(marketRows);
  const regulationCoverage = countIssuersPerRegulation(marketByTicker);
  const competitorDegree = countIssuersPerParty(
    partiesByTicker,
    RELATIONS.competesWith,
  );
  const regulatorCoverage = countIssuersPerParty(
    partiesByTicker,
    RELATIONS.regulatedBy,
  );
  const profiles = new Map<string, TickerProfileRecord>();
  for (const [ticker, facts] of factsByTicker) {
    const relations = partiesByTicker.get(ticker);
    const brands = partiesOf(relations, RELATIONS.operatesBrand);
    const subsidiaries = partiesOf(relations, RELATIONS.parentOf);
    const market = marketByTicker.get(ticker);
    const aliases = dedupeCaseInsensitive([
      ticker,
      ...allValues(facts, RDFS_LABEL),
      ...allValues(facts, `${MP}legalName`),
      ...allValues(facts, DCTERMS_ALTERNATIVE),
      ...namesOfParties(partiesOf(relations, RELATIONS.operatesBrand)),
      ...namesOfParties(partiesOf(relations, RELATIONS.parentOf)),
    ]);
    profiles.set(ticker, {
      companyOverview: pickText(facts, "companyOverview", "en"),
      businessOperation: pickText(facts, "businessOperation", "en"),
      companyOverviewIndonesian: pickText(facts, "companyOverview", "id"),
      businessOperationIndonesian: pickText(facts, "businessOperation", "id"),
      sectorIndonesian: pickText(facts, "sector", "id"),
      sectorEnglish: pickText(facts, "sector", "en"),
      subSectorIndonesian: pickText(facts, "subSector", "id"),
      subSectorEnglish: pickText(facts, "subSector", "en"),
      industryIndonesian: pickText(facts, "industry", "id"),
      industryEnglish: pickText(facts, "industry", "en"),
      subIndustryIndonesian: pickText(facts, "subIndustry", "id"),
      subIndustryEnglish: pickText(facts, "subIndustry", "en"),
      aliases,
      names: dedupeCaseInsensitive(
        [
          ...allValues(facts, RDFS_LABEL),
          ...allValues(facts, `${MP}legalName`),
          ...allValues(facts, DCTERMS_ALTERNATIVE),
        ],
        [ticker],
      ),
      brands: dedupeCaseInsensitive(
        sortedText(brands.map((party) => party.name)),
      ),
      subsidiaries: dedupeCaseInsensitive(
        sortedText(subsidiaries.map((party) => party.name)),
      ),
      ambiguousNames: dedupeCaseInsensitive([
        ...allValues(facts, `${MP}ambiguousName`),
        ...sortedText(
          [...brands, ...subsidiaries].flatMap((party) => [
            ...party.ambiguousNames,
          ]),
        ),
      ]),
      competitors: orderCompetitors(ticker, relations, competitorDegree),
      regulators: orderRegulators(relations, regulatorCoverage),
      commodities: orderCommodities(market),
      regulations: orderRegulations(market, regulationCoverage),
    });
  }

  return profiles;
};

export const loadOrganonTickerProfiles = async (
  runSparql: RunSparqlSelect,
): Promise<Map<string, TickerProfileRecord>> => {
  const [factRows, partyRows, marketRows] = await Promise.all([
    runSparql(COMPANY_FACTS_QUERY),
    runSparql(LINKED_PARTIES_QUERY),
    runSparql(MARKET_CONTEXT_QUERY),
  ]);
  const profiles = mapOrganonTickerProfiles(factRows, partyRows, marketRows);
  if (profiles.size === 0) {
    throw new Error("Organon returned no ticker profiles");
  }

  return profiles;
};
