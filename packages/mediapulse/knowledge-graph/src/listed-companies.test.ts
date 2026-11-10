import { describe, expect, it } from "vitest";

import {
  LISTED_COMPANIES_QUERY,
  loadListedCompanies,
} from "./listed-companies";
import type { SparqlBinding } from "./organon-sparql-client";

const literal = (value: string) => ({ type: "literal", value });

const row = (values: Record<string, string>): SparqlBinding =>
  Object.fromEntries(
    Object.entries(values).map(([name, value]) => [name, literal(value)]),
  );

const runSparqlReturning = (rows: SparqlBinding[]) => {
  const queries: string[] = [];
  const runSparql = async (query: string) => {
    queries.push(query);

    return rows;
  };

  return { runSparql, queries };
};

describe("loadListedCompanies", () => {
  it("sends the listed companies query", async () => {
    const { runSparql, queries } = runSparqlReturning([
      row({
        ticker: "GOTO",
        label: "GoTo",
        legalName: "PT GoTo Gojek Tokopedia Tbk",
      }),
    ]);

    await loadListedCompanies(runSparql);

    expect(queries).toEqual([LISTED_COMPANIES_QUERY]);
  });

  it("names each company by its legal name and falls back to its label", async () => {
    const { runSparql } = runSparqlReturning([
      row({
        ticker: " goto ",
        label: "GoTo",
        legalName: "  PT GoTo Gojek Tokopedia Tbk ",
      }),
      row({ ticker: "BBCA", label: "  Bank Central Asia  " }),
      row({ ticker: "MAPB", label: "MAP Boga", legalName: "   " }),
    ]);

    const companies = await loadListedCompanies(runSparql);

    expect(companies).toEqual([
      { symbol: "BBCA", name: "Bank Central Asia" },
      { symbol: "GOTO", name: "PT GoTo Gojek Tokopedia Tbk" },
      { symbol: "MAPB", name: "MAP Boga" },
    ]);
  });

  it("skips rows without a symbol or a name", async () => {
    const { runSparql } = runSparqlReturning([
      row({ ticker: "  ", label: "No Symbol Tbk" }),
      row({ ticker: "NONAME", label: "  " }),
      row({ label: "Missing Ticker Tbk" }),
      row({ ticker: "AALI", label: "Astra Agro Lestari" }),
    ]);

    const companies = await loadListedCompanies(runSparql);

    expect(companies).toEqual([{ symbol: "AALI", name: "Astra Agro Lestari" }]);
  });

  it("keeps one entry per symbol and prefers a legal name over a label", async () => {
    const { runSparql } = runSparqlReturning([
      row({ ticker: "MAPB", label: "MAP Boga" }),
      row({
        ticker: "mapb",
        label: "Boga",
        legalName: "PT Map Boga Adiperkasa Tbk",
      }),
      row({ ticker: "MAPB", label: "Map Boga Adiperkasa" }),
    ]);

    const companies = await loadListedCompanies(runSparql);

    expect(companies).toEqual([
      { symbol: "MAPB", name: "PT Map Boga Adiperkasa Tbk" },
    ]);
  });

  it("picks the same name whatever order the rows arrive in", async () => {
    const rows = [
      row({ ticker: "TLKM", label: "Telkom Indonesia" }),
      row({ ticker: "TLKM", label: "Telekomunikasi Indonesia" }),
    ];
    const forward = runSparqlReturning(rows);
    const reversed = runSparqlReturning([...rows].reverse());

    const forwardCompanies = await loadListedCompanies(forward.runSparql);
    const reversedCompanies = await loadListedCompanies(reversed.runSparql);

    expect(forwardCompanies).toEqual([
      { symbol: "TLKM", name: "Telekomunikasi Indonesia" },
    ]);
    expect(reversedCompanies).toEqual(forwardCompanies);
  });

  it("throws when the knowledge graph lists no usable company", async () => {
    const { runSparql } = runSparqlReturning([row({ ticker: "", label: "" })]);

    await expect(loadListedCompanies(runSparql)).rejects.toThrow(
      "no listed companies",
    );
  });
});
