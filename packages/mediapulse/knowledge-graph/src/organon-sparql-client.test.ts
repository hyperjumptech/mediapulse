import { describe, expect, it, vi } from "vitest";

import {
  MAX_SPARQL_QUERY_LENGTH,
  createOrganonSparqlClient,
} from "./organon-sparql-client";

const sparqlResponse = (bindings: unknown[], status = 200) =>
  new Response(
    JSON.stringify({ head: { vars: ["ticker"] }, results: { bindings } }),
    { status, headers: { "content-type": "application/sparql-results+json" } },
  );

describe("createOrganonSparqlClient", () => {
  it("posts the query to the inferred SPARQL endpoint with the API key", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        sparqlResponse([{ ticker: { type: "literal", value: "MAPB" } }]),
      );
    const runSparql = createOrganonSparqlClient({
      baseUrl: "https://organon.example//",
      apiKey: "organon_key",
      timeoutMs: 1000,
      fetchImpl,
    });

    const bindings = await runSparql("SELECT ?ticker WHERE {}");

    expect(bindings).toEqual([{ ticker: { type: "literal", value: "MAPB" } }]);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://organon.example/api/v1/sparql?inferred=true");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe("SELECT ?ticker WHERE {}");
    expect(init?.headers).toEqual({
      authorization: "Bearer organon_key",
      "content-type": "application/sparql-query",
      accept: "application/sparql-results+json",
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("refuses a query over Organon's length limit without calling it", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const runSparql = createOrganonSparqlClient({
      baseUrl: "https://organon.example",
      apiKey: "organon_key",
      timeoutMs: 1000,
      fetchImpl,
    });
    const longQuery = "x".repeat(MAX_SPARQL_QUERY_LENGTH + 1);

    await expect(runSparql(longQuery)).rejects.toThrow("over Organon's limit");

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports the status and the start of the body when Organon fails", async () => {
    const longBody = `failure ${"y".repeat(500)}`;
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(longBody, { status: 500 }));
    const runSparql = createOrganonSparqlClient({
      baseUrl: "https://organon.example",
      apiKey: "organon_key",
      timeoutMs: 1000,
      fetchImpl,
    });

    const failure = await runSparql("SELECT * WHERE {}").catch(
      (error: Error) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain(
      "Organon answered 500 to a SPARQL query: failure",
    );
    expect((failure as Error).message.length).toBeLessThan(400);
  });

  it("rejects a response that is not SPARQL JSON results", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ rows: [] })));
    const runSparql = createOrganonSparqlClient({
      baseUrl: "https://organon.example",
      apiKey: "organon_key",
      timeoutMs: 1000,
      fetchImpl,
    });

    await expect(runSparql("SELECT * WHERE {}")).rejects.toThrow();
  });
});
