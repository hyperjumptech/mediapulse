import { describe, expect, it, vi } from "vitest";

import {
  ARTICLE_CLASS_IRIS,
  MAX_INGESTION_CONTENT_LENGTH,
  MAX_INGESTION_FACT_LENGTH,
  MAX_IRIS_PER_QUERY,
  articleFiguresQuery,
  articlePointsQuery,
  buildIngestionRequest,
  createOrganonIngestionClient,
  linksWrittenBy,
  listedCompaniesAmongQuery,
  listedCompaniesByTickerQuery,
  type IngestionArticle,
} from "./organon-ingestion-client";

const MP = "https://mediapulse.hyperjump.tech/ontology#";
const DCTERMS = "http://purl.org/dc/terms/";
const PUBLISHER_IRI = "https://mediapulse.hyperjump.tech/id/publisher-kontan";
const MAPB_IRI = "https://mediapulse.hyperjump.tech/id/mapb";
const MAPI_IRI = "https://mediapulse.hyperjump.tech/id/mapi";

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
  placedForIris: [MAPB_IRI, MAPI_IRI],
  ...overrides,
});

const sparqlResponse = (bindings: unknown[]) =>
  new Response(JSON.stringify({ head: { vars: [] }, results: { bindings } }), {
    status: 200,
    headers: { "content-type": "application/sparql-results+json" },
  });

const literal = (value: string) => ({ type: "literal", value });
const uri = (value: string) => ({ type: "uri", value });
const boolean = (value: boolean) => ({
  type: "literal",
  datatype: "http://www.w3.org/2001/XMLSchema#boolean",
  value: String(value),
});

const ID = "https://mediapulse.hyperjump.tech/id/";
const MAPB = `${ID}mapb`;
const MAPI = `${ID}mapi`;
const SHOPEE = `${ID}shopee`;

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
  it("puts the date and publisher in a header the model reads, ahead of the snippet and body, and leaves the placed tickers out of it", () => {
    const request = buildIngestionRequest(article());

    expect(request.content).toBe(
      [
        "# Map Boga Adiperkasa buka 50 gerai Starbucks baru",
        "",
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
    expect(request.classIris).toHaveLength(16);
    expect(request.classIris).toContain(`${MP}ArticlePoint`);
    expect(request.classIris).toContain(`${MP}Regulator`);
    expect(request.classIris).not.toContain(`${MP}GovernmentBody`);
    expect(
      request.classIris.filter((iri) =>
        iri.startsWith("http://www.w3.org/ns/oa#"),
      ),
    ).toEqual([]);
  });

  it("sends the article's facts for its Data source, with the listed company of each placed ticker and no byline", () => {
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
      { predicate: `${MP}placedFor`, iri: MAPB_IRI },
      { predicate: `${MP}placedFor`, iri: MAPI_IRI },
    ]);
  });

  it("sends each placed-for company once", () => {
    const request = buildIngestionRequest(
      article({ placedForIris: [MAPB_IRI, MAPB_IRI] }),
    );

    expect(
      request.metadata.filter((fact) => fact.predicate === `${MP}placedFor`),
    ).toEqual([{ predicate: `${MP}placedFor`, iri: MAPB_IRI }]);
  });

  it("leaves out the facts and header lines Mediapulse has no value for", () => {
    const request = buildIngestionRequest(
      article({
        description: null,
        publishedAt: null,
        publisherIri: null,
        placedForIris: [],
      }),
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

  it("reads a job's status, the links it wrote and whether it was cut off, and returns null for a job this key never started", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            job: {
              id: "job-1",
              status: "completed",
              result: {
                instances: [
                  {
                    ref: "mapb",
                    existingIri: MAPB,
                    classIri: `${MP}ListedCompany`,
                    label: "Map Boga Adiperkasa",
                    values: [
                      { predicate: `${MP}partnersWith`, ref: "shopee" },
                      { predicate: `${MP}ticker`, value: "MAPB" },
                    ],
                    matches: [],
                    issues: null,
                  },
                  {
                    ref: "shopee",
                    classIri: `${MP}Company`,
                    label: "Shopee",
                    values: [],
                    matches: [],
                    issues: null,
                  },
                ],
                added: {
                  created: [
                    { ref: "shopee", id: "s", iri: SHOPEE, label: "Shopee" },
                  ],
                  updated: [],
                  linked: [],
                  conflicts: [],
                  skipped: [],
                  warnings: [],
                  message: null,
                },
              },
            },
          },
          200,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({ job: { id: "job-2", status: "running" } }, 200),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            job: {
              id: "job-5",
              status: "completed",
              result: { instances: "?", isPartial: true },
            },
          },
          200,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ error: "Job not found." }, 404))
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
    const client = createClient(fetchImpl);

    await expect(client.getJob("job-1")).resolves.toEqual({
      status: "completed",
      writtenLinks: [
        { subject: MAPB, predicate: `${MP}partnersWith`, object: SHOPEE },
      ],
      isPartial: false,
    });
    await expect(client.getJob("job-2")).resolves.toEqual({
      status: "running",
      writtenLinks: [],
      isPartial: false,
    });
    await expect(client.getJob("job-5")).resolves.toEqual({
      status: "completed",
      writtenLinks: null,
      isPartial: true,
    });
    await expect(client.getJob("job-3")).resolves.toBeNull();
    await expect(client.getJob("job-4")).rejects.toThrow(
      "Organon answered 500 to a read of job job-4",
    );
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://organon.example/api/v1/ingestion/jobs/job-1",
    );
  });

  it("groups an article's points with their tickers, quote and relation, and reads its figures from the history", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) =>
      String(input).includes("provenance=true")
        ? sparqlResponse([
            {
              figure: uri("https://mediapulse.hyperjump.tech/id/figure-1"),
              label: literal("MAPB revenue 9M 2026"),
              currency: uri(`${MP}CurrencyIDR`),
              currencyCode: literal("IDR"),
              hasPoint: boolean(false),
            },
            {
              figure: uri("https://mediapulse.hyperjump.tech/id/figure-2"),
              label: literal("ADES Holding revenue 1H 2026"),
              currency: uri(`${MP}CurrencySAR`),
              hasPoint: boolean(true),
            },
            {
              figure: uri("https://mediapulse.hyperjump.tech/id/figure-3"),
              currency: uri(`${MP}CurrencySGD`),
              currencyCode: literal("SGD"),
              hasPoint: boolean(true),
            },
          ])
        : sparqlResponse([
            {
              point: uri("https://mediapulse.hyperjump.tech/id/p-1"),
              ticker: literal("MAPB"),
              quote: literal("MAPB merupakan anak usaha MAPI"),
              about: uri(MAPB),
              relationObject: uri(MAPI),
              statesRelation: literal(`${MP}subsidiaryOf`),
            },
            {
              point: uri("https://mediapulse.hyperjump.tech/id/p-1"),
              ticker: literal("MAPI"),
              quote: literal("MAPB merupakan anak usaha MAPI"),
              about: uri(MAPB),
              relationObject: uri(MAPI),
              statesRelation: literal(`${MP}subsidiaryOf`),
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
          about: [MAPB],
          relationObjects: [MAPI],
          statesRelation: `${MP}subsidiaryOf`,
        },
        {
          iri: "https://mediapulse.hyperjump.tech/id/p-2",
          tickerSymbols: [],
          quote: null,
          about: [],
          relationObjects: [],
          statesRelation: null,
        },
      ],
      figuresWithoutPoint: [
        {
          iri: "https://mediapulse.hyperjump.tech/id/figure-1",
          label: "MAPB revenue 9M 2026",
        },
      ],
      figuresInCurrency: [
        {
          iri: "https://mediapulse.hyperjump.tech/id/figure-2",
          label: "ADES Holding revenue 1H 2026",
          currency: "CurrencySAR",
        },
        {
          iri: "https://mediapulse.hyperjump.tech/id/figure-3",
          label: null,
          currency: "SGD",
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
    expect(articleFiguresQuery(url)).toContain(
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

  it("find figures through the article's versions, with their currency and whether a point is about them", () => {
    const query = articleFiguresQuery(article().canonicalUrl);

    expect(query).toContain("?version dcterms:isVersionOf ?source .");
    expect(query).toContain("prov:specializationOf ?figure .");
    expect(query).toContain(
      "OPTIONAL { ?currency skos:notation ?currencyCode }",
    );
    expect(query).toContain(
      "?point a mp:ArticlePoint ; mp:about ?figure ; mp:inArticle ?source .",
    );
  });
});

describe("linksWrittenBy", () => {
  const item = (
    ref: string,
    values: { predicate: string; value?: string; ref?: string }[],
    existingIri?: string,
  ) => ({ ref, existingIri, values });
  const added = (overrides: Record<string, unknown> = {}) => ({
    created: [],
    updated: [],
    linked: [],
    skipped: [],
    rejected: [],
    ...overrides,
  });

  it("resolves refs to the instances the job created, updated or matched, and keeps IRI values", () => {
    const links = linksWrittenBy({
      instances: [
        item("mapb", [
          { predicate: `${MP}partnersWith`, ref: "shopee" },
          { predicate: `${MP}subsidiaryOf`, value: MAPI },
          { predicate: `${MP}ticker`, value: "MAPB" },
        ]),
        item("shopee", [{ predicate: `${MP}competesWith`, ref: "lazada" }]),
      ],
      added: added({
        updated: [{ ref: "mapb", iri: MAPB }],
        linked: [{ ref: "shopee", iri: SHOPEE }],
      }),
    });

    expect(links).toEqual([
      { subject: MAPB, predicate: `${MP}partnersWith`, object: SHOPEE },
      { subject: MAPB, predicate: `${MP}subsidiaryOf`, object: MAPI },
    ]);
  });

  it("leaves out skipped items, rejected values and values that aren't IRIs", () => {
    const links = linksWrittenBy({
      instances: [
        item(
          "mapb",
          [
            { predicate: `${MP}primaryCompetitor`, value: SHOPEE },
            { predicate: `${MP}partnersWith`, value: "<bad> iri" },
          ],
          MAPB,
        ),
        item(
          "shopee",
          [{ predicate: `${MP}partnersWith`, value: MAPB }],
          SHOPEE,
        ),
      ],
      added: added({
        skipped: [{ ref: "shopee" }],
        rejected: [
          {
            ref: "mapb",
            fieldErrors: { [`${MP}primaryCompetitor`]: ["curated"] },
          },
        ],
      }),
    });

    expect(links).toEqual([]);
  });

  it("returns nothing for an extract job or a job with no result", () => {
    expect(linksWrittenBy(null)).toEqual([]);
    expect(
      linksWrittenBy({
        instances: [
          item(
            "mapb",
            [{ predicate: `${MP}partnersWith`, value: SHOPEE }],
            MAPB,
          ),
        ],
        added: null,
      }),
    ).toEqual([]);
  });
});

describe("market relations and listed companies", () => {
  it("maps each market relation to itself and its inverses", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      sparqlResponse([
        { relation: uri(`${MP}competesWith`) },
        { relation: uri(`${MP}parentOf`), inverse: uri(`${MP}subsidiaryOf`) },
        { relation: uri(`${MP}subsidiaryOf`), inverse: uri(`${MP}parentOf`) },
      ]),
    );
    const client = createClient(fetchImpl);

    const relations = await client.marketRelations();

    expect(relations).toEqual(
      new Map([
        [`${MP}competesWith`, new Set([`${MP}competesWith`])],
        [`${MP}parentOf`, new Set([`${MP}parentOf`, `${MP}subsidiaryOf`])],
        [`${MP}subsidiaryOf`, new Set([`${MP}subsidiaryOf`, `${MP}parentOf`])],
      ]),
    );
  });

  it("asks which IRIs are listed companies in batches, once per IRI, skipping values that aren't IRIs", async () => {
    const iris = Array.from(
      { length: MAX_IRIS_PER_QUERY + 1 },
      (_, index) => `${ID}company-${index}`,
    );
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      sparqlResponse([{ company: uri(`${ID}company-0`) }]),
    );
    const client = createClient(fetchImpl);

    const listed = await client.listedCompaniesAmong([
      ...iris,
      iris[0] ?? "",
      "not an iri",
    ]);

    expect(listed).toEqual(new Set([`${ID}company-0`]));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("puts each IRI in the VALUES list", () => {
    expect(listedCompaniesAmongQuery([MAPB, MAPI])).toContain(
      `VALUES ?company { <${MAPB}> <${MAPI}> }`,
    );
  });

  it("finds the listed company for each ticker in batches, once per symbol", async () => {
    const symbols = Array.from(
      { length: MAX_IRIS_PER_QUERY + 1 },
      (_, index) => `T${index}`,
    );
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      sparqlResponse([
        { ticker: literal("MAPB"), company: uri(MAPB) },
        { ticker: literal("MAPI"), company: uri(MAPI) },
      ]),
    );
    const client = createClient(fetchImpl);

    const companies = await client.listedCompanyIrisByTicker([
      ...symbols,
      "T0",
    ]);

    expect(companies).toEqual(
      new Map([
        ["MAPB", MAPB],
        ["MAPI", MAPI],
      ]),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("never puts a value that isn't a ticker symbol into the ticker query", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => sparqlResponse([]));
    const client = createClient(fetchImpl);

    const companies = await client.listedCompanyIrisByTicker([
      'MAPB" } ?x ?y ?z . {',
      "mapb",
      "",
    ]);

    expect(companies).toEqual(new Map());
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keeps one company per ticker, the same one every run", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      sparqlResponse([
        { ticker: literal("MAPB"), company: uri(`${ID}mapb-2`) },
        { ticker: literal("MAPB"), company: uri(`${ID}mapb-1`) },
      ]),
    );
    const client = createClient(fetchImpl);

    const companies = await client.listedCompanyIrisByTicker(["MAPB"]);

    expect(companies).toEqual(new Map([["MAPB", `${ID}mapb-1`]]));
  });

  it("puts each symbol in the VALUES list as a quoted string", () => {
    expect(listedCompaniesByTickerQuery(["MAPB", "MAPI"])).toContain(
      'VALUES ?ticker { "MAPB" "MAPI" }',
    );
  });
});
