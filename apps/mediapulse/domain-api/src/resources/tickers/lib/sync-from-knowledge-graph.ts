import {
  TickerRemovalLimitError,
  createOrganonSparqlClient,
  loadListedCompanies,
  syncTickersFromKnowledgeGraph,
  type ListedCompany,
  type RunSparqlSelect,
  type TickerSyncDb,
  type TickerSyncResult,
} from "@mediapulse/knowledge-graph";
import type { Handler } from "hono";
import { z } from "zod";

export const KNOWLEDGE_GRAPH_SPARQL_TIMEOUT_MS = 20_000;

export const MISSING_KNOWLEDGE_GRAPH_ENV_MESSAGE =
  "Set both ORGANON_API_URL and ORGANON_API_KEY on domain-api to sync tickers from the knowledge graph.";

export type KnowledgeGraphEnv = {
  ORGANON_API_URL?: string;
  ORGANON_API_KEY?: string;
};

export type KnowledgeGraphConnection = {
  baseUrl: string;
  apiKey: string;
};

export type SyncFromKnowledgeGraphDependencies = {
  confirmToken: string;
  readEnv: () => KnowledgeGraphEnv;
  db: TickerSyncDb;
  createSparqlClient?: (
    connection: KnowledgeGraphConnection,
  ) => RunSparqlSelect;
  loadCompanies?: (runSparql: RunSparqlSelect) => Promise<ListedCompany[]>;
  syncTickers?: (
    companies: readonly ListedCompany[],
    db: TickerSyncDb,
  ) => Promise<TickerSyncResult>;
};

const createDefaultSparqlClient = (
  connection: KnowledgeGraphConnection,
): RunSparqlSelect =>
  createOrganonSparqlClient({
    ...connection,
    timeoutMs: KNOWLEDGE_GRAPH_SPARQL_TIMEOUT_MS,
  });

export const readKnowledgeGraphConnection = (
  source: KnowledgeGraphEnv,
): KnowledgeGraphConnection | null => {
  const baseUrl = source.ORGANON_API_URL?.trim() ?? "";
  const apiKey = source.ORGANON_API_KEY?.trim() ?? "";
  if (baseUrl === "" || apiKey === "") {
    return null;
  }

  return { baseUrl, apiKey };
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const createSyncFromKnowledgeGraphHandler = ({
  confirmToken,
  readEnv,
  db,
  createSparqlClient = createDefaultSparqlClient,
  loadCompanies = loadListedCompanies,
  syncTickers = syncTickersFromKnowledgeGraph,
}: SyncFromKnowledgeGraphDependencies): Handler => {
  const bodySchema = z.object({ confirm: z.literal(confirmToken) }).strict();

  return async (c) => {
    let jsonBody: unknown;
    try {
      jsonBody = await c.req.json();
    } catch {
      return c.json({ message: "Invalid JSON" }, 400);
    }
    if (!bodySchema.safeParse(jsonBody).success) {
      return c.json({ message: "Invalid request body" }, 400);
    }

    const connection = readKnowledgeGraphConnection(readEnv());
    if (connection === null) {
      return c.json({ message: MISSING_KNOWLEDGE_GRAPH_ENV_MESSAGE }, 400);
    }

    let companies: ListedCompany[];
    try {
      companies = await loadCompanies(createSparqlClient(connection));
    } catch (error) {
      const reason = describeError(error);

      return c.json(
        {
          message: `Loading listed companies from the knowledge graph failed: ${reason}`,
        },
        502,
      );
    }

    let result: TickerSyncResult;
    try {
      result = await syncTickers(companies, db);
    } catch (error) {
      if (error instanceof TickerRemovalLimitError) {
        return c.json({ message: error.message, unlisted: error.symbols }, 409);
      }
      throw error;
    }

    return c.json({ ...result, deleted: result.removed.length });
  };
};
