import { z } from "zod";

export const MAX_SPARQL_QUERY_LENGTH = 20_000;

const MAX_ERROR_BODY_LENGTH = 300;

const sparqlTermSchema = z.object({
  type: z.string(),
  value: z.string(),
  "xml:lang": z.string().optional(),
  datatype: z.string().optional(),
});

const sparqlSelectResultSchema = z.object({
  head: z.object({ vars: z.array(z.string()) }),
  results: z.object({
    bindings: z.array(z.record(z.string(), sparqlTermSchema)),
  }),
});

export type SparqlTerm = z.infer<typeof sparqlTermSchema>;

export type SparqlBinding = Record<string, SparqlTerm>;

export type RunSparqlSelect = (query: string) => Promise<SparqlBinding[]>;

export type OrganonSparqlClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

const readErrorBody = async (response: Response): Promise<string> => {
  try {
    const text = await response.text();

    return text.slice(0, MAX_ERROR_BODY_LENGTH);
  } catch {
    return "";
  }
};

export const createOrganonSparqlClient = ({
  baseUrl,
  apiKey,
  timeoutMs,
  fetchImpl = fetch,
}: OrganonSparqlClientOptions): RunSparqlSelect => {
  const origin = baseUrl.replace(/\/+$/, "");

  return async (query) => {
    if (query.length > MAX_SPARQL_QUERY_LENGTH) {
      throw new Error(
        `SPARQL query is ${query.length} characters, over Organon's limit of ${MAX_SPARQL_QUERY_LENGTH}`,
      );
    }
    const response = await fetchImpl(`${origin}/api/v1/sparql?inferred=true`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/sparql-query",
        accept: "application/sparql-results+json",
      },
      body: query,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const errorBody = await readErrorBody(response);
      throw new Error(
        `Organon answered ${response.status} to a SPARQL query: ${errorBody}`,
      );
    }
    const result = sparqlSelectResultSchema.parse(await response.json());

    return result.results.bindings;
  };
};
