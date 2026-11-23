import { z } from "zod";

import {
  createOrganonSparqlClient,
  type SparqlBinding,
} from "./organon-sparql-client";

const MP = "https://mediapulse.hyperjump.tech/ontology#";
const DCTERMS = "http://purl.org/dc/terms/";
const ORG = "http://www.w3.org/ns/org#";
const OWL = "http://www.w3.org/2002/07/owl#";
const PROV = "http://www.w3.org/ns/prov#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const SKOS = "http://www.w3.org/2004/02/skos/core#";

export const MAX_INGESTION_CONTENT_LENGTH = 200_000;
export const MAX_INGESTION_TITLE_LENGTH = 255;
export const MAX_INGESTION_FACT_LENGTH = 2_000;
export const MAX_FAILED_JOBS_PAGE_SIZE = 100;

const MAX_ERROR_BODY_LENGTH = 300;
const REGISTRABLE_DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const TICKER_SYMBOL_PATTERN = /^[A-Z0-9]{1,12}$/;

export const ARTICLE_CLASS_IRIS = [
  `${MP}ArticlePoint`,
  `${MP}ListedCompany`,
  `${MP}Company`,
  `${MP}Organization`,
  `${MP}BusinessGroup`,
  `${MP}Regulator`,
  `${MP}Brand`,
  `${MP}Product`,
  `${MP}Person`,
  `${ORG}Membership`,
  `${MP}Place`,
  `${MP}Regulation`,
  `${MP}Event`,
  `${MP}CorporateAction`,
  `${MP}Measurement`,
  `${MP}Period`,
] as const;

export type IngestionArticle = {
  canonicalUrl: string;
  url: string;
  title: string;
  description: string | null;
  content: string;
  publishedAt: string | null;
  registrableDomain: string;
  publisherIri: string | null;
  tickers: readonly { symbol: string; name: string }[];
  placedForIris: readonly string[];
};

export type IngestionMetadataFact =
  | { predicate: string; value: string }
  | { predicate: string; iri: string };

export type IngestionRequest = {
  title: string;
  content: string;
  sourceClassIri: string;
  classIris: readonly string[];
  metadata: IngestionMetadataFact[];
};

export type FailedIngestionJob = {
  id: string;
  error: string | null;
  canonicalUrl: string | null;
  finishedAt: string | null;
};

export type FailedIngestionJobsPage = {
  jobs: FailedIngestionJob[];
  nextCursor: string | null;
};

export type IngestionJobStatus =
  | "queued"
  | "running"
  | "ready"
  | "completed"
  | "failed"
  | "cancelled";

export type ArticlePoint = {
  iri: string;
  tickerSymbols: string[];
  quote: string | null;
  about: string[];
  relationObjects: string[];
  statesRelation: string | null;
};

export type ArticleFigure = { iri: string; label: string | null };

export type ArticleFigureInCurrency = ArticleFigure & { currency: string };

export type ArticleEvidence = {
  points: ArticlePoint[];
  figuresWithoutPoint: ArticleFigure[];
  figuresInCurrency: ArticleFigureInCurrency[];
};

export type WrittenLink = {
  subject: string;
  predicate: string;
  object: string;
};

export type IngestionJob = {
  status: IngestionJobStatus;
  writtenLinks: WrittenLink[] | null;
  isPartial: boolean;
};

export type MarketRelations = ReadonlyMap<string, ReadonlySet<string>>;

export type OrganonIngestionClient = {
  findPublisherIri: (registrableDomain: string) => Promise<string | null>;
  createPublisher: (input: {
    registrableDomain: string;
    label: string;
  }) => Promise<string>;
  startIngestion: (request: IngestionRequest) => Promise<{ jobId: string }>;
  listFailedJobs: (input?: {
    cursor?: string;
  }) => Promise<FailedIngestionJobsPage>;
  retryJob: (jobId: string) => Promise<"retried" | "not-retryable">;
  getJob: (jobId: string) => Promise<IngestionJob | null>;
  articleEvidence: (canonicalUrl: string) => Promise<ArticleEvidence>;
  marketRelations: () => Promise<MarketRelations>;
  listedCompaniesAmong: (
    iris: readonly string[],
  ) => Promise<ReadonlySet<string>>;
  listedCompanyIrisByTicker: (
    symbols: readonly string[],
  ) => Promise<ReadonlyMap<string, string>>;
};

export type OrganonIngestionClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

const startedJobsSchema = z.object({
  jobs: z.array(z.object({ id: z.string() })).min(1),
});

const createdInstanceSchema = z.object({ id: z.string().min(1) });

const sourceFactSchema = z.object({
  predicate: z.string(),
  value: z.string().optional(),
  iri: z.string().optional(),
});

const jobListSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.string(),
      error: z.string().nullable(),
      metadata: z.array(sourceFactSchema),
      finishedAt: z.string().nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

const refIriSchema = z.object({ ref: z.string(), iri: z.string() });

const jobResultSchema = z.object({
  instances: z
    .array(
      z.object({
        ref: z.string(),
        existingIri: z.string().nullish(),
        values: z.array(
          z.object({
            predicate: z.string(),
            value: z.string().optional(),
            ref: z.string().optional(),
          }),
        ),
      }),
    )
    .default([]),
  added: z
    .object({
      created: z.array(refIriSchema).default([]),
      updated: z.array(refIriSchema).default([]),
      linked: z.array(refIriSchema).default([]),
      skipped: z.array(z.object({ ref: z.string() })).default([]),
      rejected: z
        .array(
          z.object({
            ref: z.string(),
            fieldErrors: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .default([]),
    })
    .nullish(),
});

type JobResult = z.infer<typeof jobResultSchema>;

const partialJobResultSchema = z.object({ isPartial: z.literal(true) });

const jobSchema = z.object({
  job: z.object({
    status: z.enum([
      "queued",
      "running",
      "ready",
      "completed",
      "failed",
      "cancelled",
    ]),
    result: z.unknown().optional(),
  }),
});

const IRI_PATTERN = /^https?:\/\/[^\s<>"{}|\\^`]+$/;

export const linksWrittenBy = (result: JobResult | null | undefined) => {
  const added = result?.added;
  if (!result || !added) {
    return [];
  }
  const iriByRef = new Map<string, string>();
  for (const item of result.instances) {
    if (item.existingIri) {
      iriByRef.set(item.ref, item.existingIri);
    }
  }
  for (const { ref, iri } of [
    ...added.created,
    ...added.updated,
    ...added.linked,
  ]) {
    iriByRef.set(ref, iri);
  }
  const skippedRefs = new Set(added.skipped.map((item) => item.ref));
  const rejectedPredicatesByRef = new Map(
    added.rejected.map((item) => [
      item.ref,
      new Set(Object.keys(item.fieldErrors ?? {})),
    ]),
  );
  const links: WrittenLink[] = [];
  for (const item of result.instances) {
    const subject = iriByRef.get(item.ref);
    if (subject === undefined || skippedRefs.has(item.ref)) {
      continue;
    }
    const rejectedPredicates = rejectedPredicatesByRef.get(item.ref);
    for (const value of item.values) {
      if (rejectedPredicates?.has(value.predicate)) {
        continue;
      }
      const object =
        value.ref === undefined
          ? value.value !== undefined && IRI_PATTERN.test(value.value)
            ? value.value
            : undefined
          : iriByRef.get(value.ref);
      if (object !== undefined) {
        links.push({ subject, predicate: value.predicate, object });
      }
    }
  }

  return links;
};

const cut = (text: string, maxLength: number): string =>
  text.length > maxLength ? text.slice(0, maxLength) : text;

const textFact = (
  predicate: string,
  value: string | null,
): IngestionMetadataFact[] =>
  value === null || value.trim() === ""
    ? []
    : [{ predicate, value: cut(value, MAX_INGESTION_FACT_LENGTH) }];

export const isRegistrableDomain = (domain: string): boolean =>
  REGISTRABLE_DOMAIN_PATTERN.test(domain);

export const buildArticleContent = (article: IngestionArticle): string => {
  const placedFor = article.tickers
    .map((ticker) => `${ticker.symbol} (${ticker.name})`)
    .join(", ");
  const headerLines = [
    `# ${article.title}`,
    "",
    `- Placed for: ${placedFor}`,
    ...(article.publishedAt ? [`- Published: ${article.publishedAt}`] : []),
    `- Publisher: ${article.registrableDomain}`,
    "",
    ...(article.description ? [article.description, ""] : []),
  ];
  const header = `${headerLines.join("\n")}\n`;

  return `${header}${cut(article.content, MAX_INGESTION_CONTENT_LENGTH - header.length)}`;
};

export const buildIngestionRequest = (
  article: IngestionArticle,
): IngestionRequest => ({
  title: cut(article.title, MAX_INGESTION_TITLE_LENGTH),
  content: buildArticleContent(article),
  sourceClassIri: `${MP}DataSource`,
  classIris: ARTICLE_CLASS_IRIS,
  metadata: [
    ...textFact(`${MP}canonicalUrl`, article.canonicalUrl),
    ...textFact(`${MP}url`, article.url),
    ...textFact(`${DCTERMS}title`, article.title),
    ...textFact(`${DCTERMS}description`, article.description),
    ...textFact(`${MP}publishedAt`, article.publishedAt),
    { predicate: `${MP}sourceKind`, iri: `${MP}SourceNews` },
    ...(article.publisherIri
      ? [{ predicate: `${DCTERMS}publisher`, iri: article.publisherIri }]
      : []),
    ...[...new Set(article.placedForIris)].map((iri) => ({
      predicate: `${MP}placedFor`,
      iri,
    })),
  ],
});

const sparqlString = (value: string): string => JSON.stringify(value);

const articleSourcePattern = (canonicalUrl: string): string[] => [
  "  ?source a mp:DataSource ; mp:canonicalUrl ?url .",
  `  FILTER(STR(?url) = ${sparqlString(canonicalUrl)})`,
];

export const articlePointsQuery = (canonicalUrl: string): string =>
  [
    `PREFIX mp: <${MP}>`,
    "SELECT ?point ?ticker ?quote ?about ?relationObject ?statesRelation WHERE {",
    ...articleSourcePattern(canonicalUrl),
    "  ?point a mp:ArticlePoint ; mp:inArticle ?source .",
    "  OPTIONAL { ?point mp:forTicker/mp:ticker ?ticker }",
    "  OPTIONAL { ?point mp:quote ?quote }",
    "  OPTIONAL { ?point mp:about ?about }",
    "  OPTIONAL { ?point mp:relationObject ?relationObject }",
    "  OPTIONAL { ?point mp:statesRelation ?statesRelation }",
    "}",
  ].join("\n");

export const articleFiguresQuery = (canonicalUrl: string): string =>
  [
    `PREFIX dcterms: <${DCTERMS}>`,
    `PREFIX mp: <${MP}>`,
    `PREFIX prov: <${PROV}>`,
    `PREFIX rdfs: <${RDFS}>`,
    `PREFIX skos: <${SKOS}>`,
    "SELECT DISTINCT ?figure ?label ?currency ?currencyCode ?hasPoint WHERE {",
    ...articleSourcePattern(canonicalUrl),
    "  ?version dcterms:isVersionOf ?source .",
    "  ?revision prov:wasDerivedFrom ?version ;",
    "    prov:specializationOf ?figure .",
    "  ?figure a mp:Measurement .",
    "  OPTIONAL { ?figure rdfs:label ?label }",
    "  OPTIONAL {",
    "    ?figure mp:currency ?currency .",
    "    OPTIONAL { ?currency skos:notation ?currencyCode }",
    "  }",
    "  BIND(EXISTS {",
    "    ?point a mp:ArticlePoint ; mp:about ?figure ; mp:inArticle ?source .",
    "  } AS ?hasPoint)",
    "}",
  ].join("\n");

export const MARKET_RELATIONS_QUERY = [
  `PREFIX mp: <${MP}>`,
  `PREFIX owl: <${OWL}>`,
  `PREFIX rdfs: <${RDFS}>`,
  "SELECT ?relation ?inverse WHERE {",
  "  ?relation rdfs:subPropertyOf+ mp:relatedTo .",
  "  OPTIONAL {",
  "    { ?relation owl:inverseOf ?inverse } UNION { ?inverse owl:inverseOf ?relation }",
  "  }",
  "}",
].join("\n");

export const MAX_IRIS_PER_QUERY = 100;

export const listedCompaniesAmongQuery = (iris: readonly string[]): string =>
  [
    `PREFIX mp: <${MP}>`,
    "SELECT DISTINCT ?company WHERE {",
    `  VALUES ?company { ${iris.map((iri) => `<${iri}>`).join(" ")} }`,
    "  ?company a mp:ListedCompany .",
    "}",
  ].join("\n");

export const isTickerSymbol = (symbol: string): boolean =>
  TICKER_SYMBOL_PATTERN.test(symbol);

export const listedCompaniesByTickerQuery = (
  symbols: readonly string[],
): string =>
  [
    `PREFIX mp: <${MP}>`,
    "SELECT ?ticker ?company WHERE {",
    `  VALUES ?ticker { ${symbols.map(sparqlString).join(" ")} }`,
    "  ?company a mp:ListedCompany ; mp:ticker ?ticker .",
    "}",
  ].join("\n");

type PointDraft = {
  tickerSymbols: Set<string>;
  quote: string | null;
  about: Set<string>;
  relationObjects: Set<string>;
  statesRelation: string | null;
};

const toPoints = (bindings: readonly SparqlBinding[]): ArticlePoint[] => {
  const byIri = new Map<string, PointDraft>();
  for (const binding of bindings) {
    const iri = binding.point?.value;
    if (!iri) {
      continue;
    }
    const point = byIri.get(iri) ?? {
      tickerSymbols: new Set<string>(),
      quote: null,
      about: new Set<string>(),
      relationObjects: new Set<string>(),
      statesRelation: null,
    };
    if (binding.ticker) {
      point.tickerSymbols.add(binding.ticker.value);
    }
    if (binding.quote) {
      point.quote = binding.quote.value;
    }
    if (binding.about) {
      point.about.add(binding.about.value);
    }
    if (binding.relationObject) {
      point.relationObjects.add(binding.relationObject.value);
    }
    if (binding.statesRelation) {
      point.statesRelation = binding.statesRelation.value;
    }
    byIri.set(iri, point);
  }

  return [...byIri].map(([iri, point]) => ({
    iri,
    tickerSymbols: [...point.tickerSymbols],
    quote: point.quote,
    about: [...point.about],
    relationObjects: [...point.relationObjects],
    statesRelation: point.statesRelation,
  }));
};

const OWN_CURRENCIES = new Set(["IDR", "USD"]);

const currencyCodeOf = (binding: SparqlBinding): string | null => {
  const code = binding.currencyCode?.value;
  if (code) {
    return code;
  }
  const iri = binding.currency?.value;

  return iri ? iri.slice(iri.lastIndexOf("#") + 1) : null;
};

const toFigures = (
  bindings: readonly SparqlBinding[],
): Pick<ArticleEvidence, "figuresWithoutPoint" | "figuresInCurrency"> => {
  const figuresWithoutPoint: ArticleFigure[] = [];
  const figuresInCurrency: ArticleFigureInCurrency[] = [];
  const seen = new Set<string>();
  for (const binding of bindings) {
    const iri = binding.figure?.value;
    if (!iri || seen.has(iri)) {
      continue;
    }
    seen.add(iri);
    const figure = { iri, label: binding.label?.value ?? null };
    if (binding.hasPoint?.value !== "true") {
      figuresWithoutPoint.push(figure);
    }
    const currency = currencyCodeOf(binding);
    if (currency !== null && !OWN_CURRENCIES.has(currency)) {
      figuresInCurrency.push({ ...figure, currency });
    }
  }

  return { figuresWithoutPoint, figuresInCurrency };
};

const toMarketRelations = (
  bindings: readonly SparqlBinding[],
): MarketRelations => {
  const equivalents = new Map<string, Set<string>>();
  for (const binding of bindings) {
    const relation = binding.relation?.value;
    if (!relation) {
      continue;
    }
    const same = equivalents.get(relation) ?? new Set([relation]);
    if (binding.inverse) {
      same.add(binding.inverse.value);
    }
    equivalents.set(relation, same);
  }

  return equivalents;
};

export const instanceIriFromId = (id: string): string =>
  Buffer.from(id, "base64url").toString("utf8");

const readErrorBody = async (response: Response): Promise<string> => {
  try {
    const text = await response.text();

    return text.slice(0, MAX_ERROR_BODY_LENGTH);
  } catch {
    return "";
  }
};

const failure = async (response: Response, action: string): Promise<Error> =>
  new Error(
    `Organon answered ${response.status} to ${action}: ${await readErrorBody(response)}`,
  );

export const createOrganonIngestionClient = ({
  baseUrl,
  apiKey,
  timeoutMs,
  fetchImpl = fetch,
}: OrganonIngestionClientOptions): OrganonIngestionClient => {
  const origin = baseUrl.replace(/\/+$/, "");
  const runSparql = createOrganonSparqlClient({
    baseUrl,
    apiKey,
    timeoutMs,
    fetchImpl,
  });
  const runHistorySparql = createOrganonSparqlClient({
    baseUrl,
    apiKey,
    timeoutMs,
    fetchImpl,
    includeInferred: false,
    includeProvenance: true,
  });
  const request = (path: string, init: RequestInit = {}) =>
    fetchImpl(`${origin}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

  return {
    findPublisherIri: async (registrableDomain) => {
      if (!isRegistrableDomain(registrableDomain)) {
        return null;
      }
      const bindings = await runSparql(
        [
          `PREFIX mp: <${MP}>`,
          "SELECT ?publisher WHERE {",
          `  ?publisher a mp:Publisher ; mp:registrableDomain "${registrableDomain}" .`,
          "}",
          "LIMIT 1",
        ].join("\n"),
      );

      return bindings[0]?.publisher?.value ?? null;
    },

    createPublisher: async ({ registrableDomain, label }) => {
      const response = await request("/api/v1/instances", {
        method: "POST",
        body: JSON.stringify({
          classIri: `${MP}Publisher`,
          label,
          values: [
            { predicate: `${MP}registrableDomain`, value: registrableDomain },
          ],
        }),
      });
      if (response.status !== 201) {
        throw await failure(response, "a new publisher");
      }
      const { id } = createdInstanceSchema.parse(await response.json());

      return instanceIriFromId(id);
    },

    startIngestion: async (ingestion) => {
      const response = await request("/api/v1/ingestion", {
        method: "POST",
        body: JSON.stringify(ingestion),
      });
      if (response.status !== 202) {
        throw await failure(response, "an ingestion job");
      }
      const { jobs } = startedJobsSchema.parse(await response.json());
      const [job] = jobs;
      if (!job) {
        throw new Error("Organon started no ingestion job");
      }

      return { jobId: job.id };
    },

    listFailedJobs: async ({ cursor } = {}) => {
      const search = new URLSearchParams({
        status: "failed",
        limit: String(MAX_FAILED_JOBS_PAGE_SIZE),
        ...(cursor ? { cursor } : {}),
      });
      const response = await request(`/api/v1/ingestion/jobs?${search}`);
      if (!response.ok) {
        throw await failure(response, "the failed ingestion jobs");
      }
      const page = jobListSchema.parse(await response.json());

      return {
        jobs: page.jobs.map((job) => ({
          id: job.id,
          error: job.error,
          canonicalUrl:
            job.metadata.find((fact) => fact.predicate === `${MP}canonicalUrl`)
              ?.value ?? null,
          finishedAt: job.finishedAt,
        })),
        nextCursor: page.nextCursor,
      };
    },

    retryJob: async (jobId) => {
      const response = await request(
        `/api/v1/ingestion/jobs/${encodeURIComponent(jobId)}/retry`,
        { method: "POST" },
      );
      if (response.status === 202) {
        return "retried";
      }
      if (response.status === 404 || response.status === 409) {
        return "not-retryable";
      }
      throw await failure(response, `a retry of job ${jobId}`);
    },

    getJob: async (jobId) => {
      const response = await request(
        `/api/v1/ingestion/jobs/${encodeURIComponent(jobId)}`,
      );
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw await failure(response, `a read of job ${jobId}`);
      }
      const { job } = jobSchema.parse(await response.json());

      const result = jobResultSchema.nullish().safeParse(job.result);

      return {
        status: job.status,
        writtenLinks: result.success ? linksWrittenBy(result.data) : null,
        isPartial: partialJobResultSchema.safeParse(job.result).success,
      };
    },

    articleEvidence: async (canonicalUrl) => {
      const [pointBindings, figureBindings] = await Promise.all([
        runSparql(articlePointsQuery(canonicalUrl)),
        runHistorySparql(articleFiguresQuery(canonicalUrl)),
      ]);

      return { points: toPoints(pointBindings), ...toFigures(figureBindings) };
    },

    marketRelations: async () =>
      toMarketRelations(await runSparql(MARKET_RELATIONS_QUERY)),

    listedCompaniesAmong: async (iris) => {
      const unique = [...new Set(iris)].filter((iri) => IRI_PATTERN.test(iri));
      const listed = new Set<string>();
      for (let start = 0; start < unique.length; start += MAX_IRIS_PER_QUERY) {
        const bindings = await runSparql(
          listedCompaniesAmongQuery(
            unique.slice(start, start + MAX_IRIS_PER_QUERY),
          ),
        );
        for (const binding of bindings) {
          if (binding.company) {
            listed.add(binding.company.value);
          }
        }
      }

      return listed;
    },

    listedCompanyIrisByTicker: async (symbols) => {
      const unique = [...new Set(symbols)].filter(isTickerSymbol);
      const companyBySymbol = new Map<string, string>();
      for (let start = 0; start < unique.length; start += MAX_IRIS_PER_QUERY) {
        const bindings = await runSparql(
          listedCompaniesByTickerQuery(
            unique.slice(start, start + MAX_IRIS_PER_QUERY),
          ),
        );
        for (const binding of bindings) {
          const symbol = binding.ticker?.value;
          const company = binding.company?.value;
          if (!symbol || !company || !IRI_PATTERN.test(company)) {
            continue;
          }
          const current = companyBySymbol.get(symbol);
          if (current === undefined || company < current) {
            companyBySymbol.set(symbol, company);
          }
        }
      }

      return companyBySymbol;
    },
  };
};
