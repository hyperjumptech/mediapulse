import { describe, expect, it, vi } from "vitest";

import {
  ARTICLE_CLASS_IRIS,
  MAX_INGESTION_CONTENT_LENGTH,
  MAX_INGESTION_FACT_LENGTH,
  articlePointsQuery,
  buildIngestionRequest,
  createOrganonIngestionClient,
  figuresWithoutPointQuery,
  type IngestionArticle,
} from "./organon-ingestion-client";

const MP = "https://mediapulse.hyperjump.tech/ontology#";
const DCTERMS = "http://purl.org/dc/terms/";
const PUBLISHER_IRI = "https://mediapulse.hyperjump.tech/id/publisher-kontan";

const article = (
  overrides: Partial<IngestionArticle> = {},
): IngestionArticle => ({
  canonicalUrl: "https://www.kontan.co.id/news/map-boga-buka-gerai",
  url: "https://www.kontan.co.id/news/map-boga-buka-gerai?utm_source=google",
  title: "Map Boga Adiperkasa buka 50 gerai Starbucks baru",
  description: "MAPB membuka 50 gerai baru.",
  content: "Isi artikel.",
  publishedAt: "2026-11-14T01:30:00.000Z",
  registrableDomain: "kontan.co.id",
  publisherIri: PUBLISHER_IRI,
  tickers: [
    { symbol: "MAPB", name: "PT Map Boga Adiperkasa Tbk" },
    { symbol: "MAPI", name: "PT Mitra Adiperkasa Tbk" },
  ],
  ...overrides,
});

const sparqlResponse = (bindings: unknown[]) =>
  new Response(JSON.stringify({ head: { vars: [] }, results: { bindings } }), {
    status: 200,
    headers: { "content-type": "application/sparql-results+json" },
  });

const literal = (value: string) => ({ type: "literal", value });
const uri = (value: string) => ({ type: "uri", value });

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const createClient = (fetchImpl: typeof fetch) =>
  createOrganonIngestionClient({
    baseUrl: "https://organon.example/",
    apiKey: "ingestion_key",
    timeoutMs: 1000,
    fetchImpl,
  });

describe("buildIngestionRequest", () => {
  it("puts the tickers, date and publisher in a header the model reads, ahead of the snippet and body", () => {
    const request = buildIngestionRequest(article());

    expect(request.content).toBe(
      [
        "# Map Boga Adiperkasa buka 50 gerai Starbucks baru",
        "",
        "- Placed for: MAPB (PT Map Boga Adiperkasa Tbk), MAPI (PT Mitra Adiperkasa Tbk)",
        "- Published: 2026-11-14T01:30:00.000Z",
        "- Publisher: kontan.co.id",
        "",
        "MAPB membuka 50 gerai baru.",
        "",
        "Isi artikel.",
      ].join("\n"),
    );
    expect(request.sourceClassIri).toBe(`${MP}DataSource`);
    expect(request.classIris).toEqual(ARTICLE_CLASS_IRIS);
    expect(request.classIris).toHaveLength(17);
    expect(request.classIris).toContain(`${MP}ArticlePoint`);
    expect(
      request.classIris.filter((iri) =>
        iri.startsWith("http://www.w3.org/ns/oa#"),
      ),
    ).toEqual([]);
  });

  it("sends the article's facts for its Data source, with no byline", () => {
    const request = buildIngestionRequest(article());

    expect(request.metadata).toEqual([
      {
        predicate: `${MP}canonicalUrl`,
        value: "https://www.kontan.co.id/news/map-boga-buka-gerai",
      },
      {
        predicate: `${MP}url`,
        value:
          "https://www.kontan.co.id/news/map-boga-buka-gerai?utm_source=google",
      },
      {
        predicate: `${DCTERMS}title`,
        value: "Map Boga Adiperkasa buka 50 gerai Starbucks baru",
      },
      {
        predicate: `${DCTERMS}description`,
        value: "MAPB membuka 50 gerai baru.",
      },
      { predicate: `${MP}publishedAt`, value: "2026-11-14T01:30:00.000Z" },
      { predicate: `${MP}sourceKind`, iri: `${MP}SourceNews` },
      { predicate: `${DCTERMS}publisher`, iri: PUBLISHER_IRI },
    ]);
  });

  it("leaves out the facts and header lines Mediapulse has no value for", () => {
    const request = buildIngestionRequest(
      article({ description: null, publishedAt: null, publisherIri: null }),
    );

    expect(request.content).not.toContain("- Published:");
    expect(request.metadata.map((fact) => fact.predicate)).toEqual([
      `${MP}canonicalUrl`,
      `${MP}url`,
      `${DCTERMS}title`,
      `${MP}sourceKind`,
    ]);
  });

  it("cuts the body, never the header, to stay within Organon's content limit", () => {
    const request = buildIngestionRequest(
      article({ content: "x".repeat(MAX_INGESTION_CONTENT_LENGTH) }),
    );

    expect(request.content).toHaveLength(MAX_INGESTION_CONTENT_LENGTH);
    expect(request.content.startsWith("# Map Boga Adiperkasa")).toBe(true);
  });

  it("cuts a long title and description to the lengths Organon accepts", () => {
    const request = buildIngestionRequest(
      article({ title: "t".repeat(400), description: "d".repeat(3_000) }),
    );

    expect(request.title).toHaveLength(255);
    const description = request.metadata.find(
      (fact) => fact.predicate === `${DCTERMS}description`,
    );
    expect(
      description && "value" in description && description.value,
    ).toHaveLength(MAX_INGESTION_FACT_LENGTH);
  });
});

describe("createOrganonIngestionClient", () => {
  it("finds a publisher by its registrable domain", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          head: { vars: ["publisher"] },
          results: {
            bindings: [{ publisher: { type: "uri", value: PUBLISHER_IRI } }],
          },
        },
        200,
      ),
    );

    const iri = await createClient(fetchImpl).findPublisherIri("kontan.co.id");

    expect(iri).toBe(PUBLISHER_IRI);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://organon.example/api/v1/sparql?inferred=true");
    expect(init?.body).toContain('mp:registrableDomain "kontan.co.id"');
  });

  it("never puts a value that isn't a domain into the publisher query", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    const iri = await createClient(fetchImpl).findPublisherIri('evil" } #');

    expect(iri).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("creates a publisher and returns its IRI from the instance id", async () => {
    const id = Buffer.from(PUBLISHER_IRI).toString("base64url");
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ id }, 201));

    const iri = await createClient(fetchImpl).createPublisher({
      registrableDomain: "kontan.co.id",
      label: "kontan.co.id",
    });

    expect(iri).toBe(PUBLISHER_IRI);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://organon.example/api/v1/instances");
    expect(JSON.parse(String(init?.body))).toEqual({
      classIri: `${MP}Publisher`,
      label: "kontan.co.id",
      values: [{ predicate: `${MP}registrableDomain`, value: "kontan.co.id" }],
    });
    expect(init?.headers).toEqual({
      authorization: "Bearer ingestion_key",
      accept: "application/json",
      "content-type": "application/json",
    });
  });

  it("starts a job and returns its id", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ jobs: [{ id: "job-1", status: "queued" }] }, 202),
      );
    const request = buildIngestionRequest(article());

    const result = await createClient(fetchImpl).startIngestion(request);

    expect(result).toEqual({ jobId: "job-1" });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://organon.example/api/v1/ingestion");
    expect(JSON.parse(String(init?.body))).toEqual(request);
  });

  it("reports the status and body when Organon refuses a job", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ error: "No Concepts version is published." }, 422),
      );

    await expect(
      createClient(fetchImpl).startIngestion(buildIngestionRequest(article())),
    ).rejects.toThrow(
      'Organon answered 422 to an ingestion job: {"error":"No Concepts version is published."}',
    );
  });

  it("lists failed jobs with the article each one was for", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          jobs: [
            {
              id: "job-1",
              status: "failed",
              error: "Provider timed out",
              finishedAt: "2026-11-17T02:00:00.000Z",
              metadata: [
                {
                  predicate: `${MP}canonicalUrl`,
                  value: "https://www.kontan.co.id/news/map-boga-buka-gerai",
                },
              ],
            },
          ],
          nextCursor: "cursor-2",
        },
        200,
      ),
    );

    const page = await createClient(fetchImpl).listFailedJobs({
      cursor: "cursor-1",
    });

    expect(page).toEqual({
      jobs: [
        {
          id: "job-1",
          error: "Provider timed out",
          canonicalUrl: "https://www.kontan.co.id/news/map-boga-buka-gerai",
          finishedAt: "2026-11-17T02:00:00.000Z",
        },
      ],
      nextCursor: "cursor-2",
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://organon.example/api/v1/ingestion/jobs?status=failed&limit=100&cursor=cursor-1",
    );
  });

  it("retries a failed job, and says when Organon won't retry it", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ job: { id: "job-1" } }, 202))
      .mockResolvedValueOnce(jsonResponse({ error: "can't be retried" }, 409))
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
    const client = createClient(fetchImpl);

    await expect(client.retryJob("job-1")).resolves.toBe("retried");
    await expect(client.retryJob("job-2")).resolves.toBe("not-retryable");
    await expect(client.retryJob("job-3")).rejects.toThrow(
      "Organon answered 500 to a retry of job job-3",
    );
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://organon.example/api/v1/ingestion/jobs/job-1/retry",
    );
  });

  it("reads a job's status, and returns null for a job this key never started", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ job: { id: "job-1", status: "completed" } }, 200),
      )
      .mockResolvedValueOnce(jsonResponse({ error: "Job not found." }, 404))
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
    const client = createClient(fetchImpl);

    await expect(client.getJobStatus("job-1")).resolves.toBe("completed");
    await expect(client.getJobStatus("job-2")).resolves.toBeNull();
    await expect(client.getJobStatus("job-3")).rejects.toThrow(
      "Organon answered 500 to a read of job job-3",
    );
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://organon.example/api/v1/ingestion/jobs/job-1",
    );
  });

  it("groups an article's points with their tickers and quote, and reads its figures no point is about from the history", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) =>
      String(input).includes("provenance=true")
        ? sparqlResponse([
            {
              figure: uri("https://mediapulse.hyperjump.tech/id/figure-1"),
              label: literal("MAPB revenue 9M 2026"),
            },
          ])
        : sparqlResponse([
            {
              point: uri("https://mediapulse.hyperjump.tech/id/p-1"),
              ticker: literal("MAPB"),
              quote: literal("MAPB merupakan anak usaha MAPI"),
            },
            {
              point: uri("https://mediapulse.hyperjump.tech/id/p-1"),
              ticker: literal("MAPI"),
              quote: literal("MAPB merupakan anak usaha MAPI"),
            },
            { point: uri("https://mediapulse.hyperjump.tech/id/p-2") },
          ]),
    );
    const client = createClient(fetchImpl);

    const evidence = await client.articleEvidence(article().canonicalUrl);

    expect(evidence).toEqual({
      points: [
        {
          iri: "https://mediapulse.hyperjump.tech/id/p-1",
          tickerSymbols: ["MAPB", "MAPI"],
          quote: "MAPB merupakan anak usaha MAPI",
        },
        {
          iri: "https://mediapulse.hyperjump.tech/id/p-2",
          tickerSymbols: [],
          quote: null,
        },
      ],
      figuresWithoutPoint: [
        {
          iri: "https://mediapulse.hyperjump.tech/id/figure-1",
          label: "MAPB revenue 9M 2026",
        },
      ],
    });
    const urls = fetchImpl.mock.calls.map(([input]) => String(input)).sort();
    expect(urls).toEqual([
      "https://organon.example/api/v1/sparql?inferred=true",
      "https://organon.example/api/v1/sparql?provenance=true",
    ]);
  });
});

describe("article evidence queries", () => {
  it("compare the canonical URL as a string, escaped so a URL can't break the query", () => {
    const url = 'https://example.com/a"b\\c';

    expect(articlePointsQuery(url)).toContain(
      'FILTER(STR(?url) = "https://example.com/a\\"b\\\\c")',
    );
    expect(figuresWithoutPointQuery(url)).toContain(
      'FILTER(STR(?url) = "https://example.com/a\\"b\\\\c")',
    );
  });

  it("find an article's points through the article they name", () => {
    const query = articlePointsQuery(article().canonicalUrl);

    expect(query).toContain(
      "?point a mp:ArticlePoint ; mp:inArticle ?source .",
    );
    expect(query).toContain("OPTIONAL { ?point mp:quote ?quote }");
  });

  it("find figures through the article's versions and skip the ones a point is about", () => {
    const query = figuresWithoutPointQuery(article().canonicalUrl);

    expect(query).toContain("?version dcterms:isVersionOf ?source .");
    expect(query).toContain("prov:specializationOf ?figure .");
    expect(query).toContain(
      "?point a mp:ArticlePoint ; mp:about ?figure ; mp:inArticle ?source .",
    );
  });
});
