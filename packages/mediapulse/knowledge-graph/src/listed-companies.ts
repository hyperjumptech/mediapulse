import type { RunSparqlSelect, SparqlBinding } from "./organon-sparql-client";

export const LISTED_COMPANIES_QUERY = `PREFIX mp: <https://mediapulse.hyperjump.tech/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?ticker ?label ?legalName WHERE {
  ?company a mp:ListedCompany ; mp:ticker ?ticker ; rdfs:label ?label .
  OPTIONAL { ?company mp:legalName ?legalName }
}`;

export type ListedCompany = {
  symbol: string;
  name: string;
};

type NameCandidate = {
  name: string;
  isLegalName: boolean;
};

const bindingValue = (binding: SparqlBinding, name: string): string =>
  binding[name]?.value.trim() ?? "";

const compareText = (first: string, second: string): number => {
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

const isPreferredName = (
  candidate: NameCandidate,
  current: NameCandidate,
): boolean => {
  if (candidate.isLegalName !== current.isLegalName) {
    return candidate.isLegalName;
  }

  return compareText(candidate.name, current.name) < 0;
};

const nameCandidateOf = (row: SparqlBinding): NameCandidate => {
  const legalName = bindingValue(row, "legalName");
  if (legalName !== "") {
    return { name: legalName, isLegalName: true };
  }

  return { name: bindingValue(row, "label"), isLegalName: false };
};

export const loadListedCompanies = async (
  runSparql: RunSparqlSelect,
): Promise<ListedCompany[]> => {
  const rows = await runSparql(LISTED_COMPANIES_QUERY);
  const nameBySymbol = new Map<string, NameCandidate>();
  for (const row of rows) {
    const symbol = bindingValue(row, "ticker").toUpperCase();
    const candidate = nameCandidateOf(row);
    if (symbol === "" || candidate.name === "") {
      continue;
    }
    const current = nameBySymbol.get(symbol);
    if (current === undefined || isPreferredName(candidate, current)) {
      nameBySymbol.set(symbol, candidate);
    }
  }
  if (nameBySymbol.size === 0) {
    throw new Error(
      "The knowledge graph returned no listed companies with a ticker and a name",
    );
  }

  return [...nameBySymbol.entries()]
    .sort(([firstSymbol], [secondSymbol]) =>
      compareText(firstSymbol, secondSymbol),
    )
    .map(([symbol, candidate]) => ({ symbol, name: candidate.name }));
};
