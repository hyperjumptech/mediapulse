import { z } from "zod";

import {
  createOrganonSparqlClient,
  type SparqlBinding,
} from "./organon-sparql-client";

const MP = "https://mediapulse.hyperjump.tech/ontology#";
const DCTERMS = "http://purl.org/dc/terms/";
const OA = "http://www.w3.org/ns/oa#";
const ORG = "http://www.w3.org/ns/org#";
const PROV = "http://www.w3.org/ns/prov#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";

export const MAX_INGESTION_CONTENT_LENGTH = 200_000;
export const MAX_INGESTION_TITLE_LENGTH = 255;
export const MAX_INGESTION_FACT_LENGTH = 2_000;
export const MAX_FAILED_JOBS_PAGE_SIZE = 100;

const MAX_ERROR_BODY_LENGTH = 300;
const REGISTRABLE_DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export const ARTICLE_CLASS_IRIS = [
  `${OA}Annotation`,
  `${OA}SpecificResource`,
  `${OA}TextQuoteSelector`,
  `${MP}ListedCompany`,
  `${MP}Company`,
  `${MP}Organization`,
  `${MP}BusinessGroup`,
  `${MP}GovernmentBody`,
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

export type ArticleAnnotation = {
  iri: string;
  tickerSymbols: string[];
  quotes: string[];
};

export type ArticleFigure = { iri: string; label: string | null };

export type ArticleEvidence = {
  annotations: ArticleAnnotation[];
  figuresWithoutAnnotation: ArticleFigure[];
};

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
  getJobStatus: (jobId: string) => Promise<IngestionJobStatus | null>;
  articleEvidence: (canonicalUrl: string) => Promise<ArticleEvidence>;
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
  }),
});

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
  ],
});

const sparqlString = (value: string): string => JSON.stringify(value);

const articleSourcePattern = (canonicalUrl: string): string[] => [
  "  ?source a mp:DataSource ; mp:canonicalUrl ?url .",
  `  FILTER(STR(?url) = ${sparqlString(canonicalUrl)})`,
];

export const articleAnnotationsQuery = (canonicalUrl: string): string =>
  [
    `PREFIX mp: <${MP}>`,
    `PREFIX oa: <${OA}>`,
    "SELECT ?annotation ?ticker ?quote WHERE {",
    ...articleSourcePattern(canonicalUrl),
    "  ?target oa:hasSource ?source .",
    "  ?annotation oa:hasTarget ?target .",
    "  OPTIONAL { ?annotation mp:forTicker/mp:ticker ?ticker }",
    "  OPTIONAL { ?target oa:hasSelector/oa:exact ?quote }",
    "}",
  ].join("\n");

export const figuresWithoutAnnotationQuery = (canonicalUrl: string): string =>
  [
    `PREFIX dcterms: <${DCTERMS}>`,
    `PREFIX mp: <${MP}>`,
    `PREFIX oa: <${OA}>`,
    `PREFIX prov: <${PROV}>`,
    `PREFIX rdfs: <${RDFS}>`,
    "SELECT DISTINCT ?figure ?label WHERE {",
    ...articleSourcePattern(canonicalUrl),
    "  ?version dcterms:isVersionOf ?source .",
    "  ?revision prov:wasDerivedFrom ?version ;",
    "    prov:specializationOf ?figure .",
    "  ?figure a mp:Measurement .",
    "  OPTIONAL { ?figure rdfs:label ?label }",
    "  FILTER NOT EXISTS {",
    "    ?annotation oa:hasBody ?figure ;",
    "      oa:hasTarget/oa:hasSource ?source .",
    "  }",
    "}",
  ].join("\n");

const toAnnotations = (
  bindings: readonly SparqlBinding[],
): ArticleAnnotation[] => {
  const byIri = new Map<
    string,
    { tickerSymbols: Set<string>; quotes: Set<string> }
  >();
  for (const binding of bindings) {
    const iri = binding.annotation?.value;
    if (!iri) {
      continue;
    }
    const annotation = byIri.get(iri) ?? {
      tickerSymbols: new Set<string>(),
      quotes: new Set<string>(),
    };
    if (binding.ticker) {
      annotation.tickerSymbols.add(binding.ticker.value);
    }
    if (binding.quote) {
      annotation.quotes.add(binding.quote.value);
    }
    byIri.set(iri, annotation);
  }

  return [...byIri].map(([iri, { tickerSymbols, quotes }]) => ({
    iri,
    tickerSymbols: [...tickerSymbols],
    quotes: [...quotes],
  }));
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

    getJobStatus: async (jobId) => {
      const response = await request(
        `/api/v1/ingestion/jobs/${encodeURIComponent(jobId)}`,
      );
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw await failure(response, `a read of job ${jobId}`);
      }

      return jobSchema.parse(await response.json()).job.status;
    },

    articleEvidence: async (canonicalUrl) => {
      const [annotationBindings, figureBindings] = await Promise.all([
        runSparql(articleAnnotationsQuery(canonicalUrl)),
        runHistorySparql(figuresWithoutAnnotationQuery(canonicalUrl)),
      ]);

      return {
        annotations: toAnnotations(annotationBindings),
        figuresWithoutAnnotation: figureBindings.flatMap((binding) =>
          binding.figure
            ? [
                {
                  iri: binding.figure.value,
                  label: binding.label?.value ?? null,
                },
              ]
            : [],
        ),
      };
    },
  };
};
