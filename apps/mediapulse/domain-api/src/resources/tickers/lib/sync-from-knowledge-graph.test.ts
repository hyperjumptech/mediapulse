import {
  TickerRemovalLimitError,
  type ListedCompany,
  type RunSparqlSelect,
  type TickerSyncDb,
  type TickerSyncResult,
} from "@mediapulse/knowledge-graph";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import {
  MISSING_KNOWLEDGE_GRAPH_ENV_MESSAGE,
  createSyncFromKnowledgeGraphHandler,
  readKnowledgeGraphConnection,
  type KnowledgeGraphConnection,
  type KnowledgeGraphEnv,
} from "./sync-from-knowledge-graph";

const confirmToken = "SYNC_TEST";

const fakeDb = {} as TickerSyncDb;

const listedCompanies: ListedCompany[] = [
  { symbol: "BBCA", name: "PT Bank Central Asia Tbk" },
  { symbol: "GOTO", name: "PT GoTo Gojek Tokopedia Tbk" },
];

const syncResult: TickerSyncResult = {
  added: 1,
  alreadyPresent: 1,
  removed: ["TOYS"],
  keptUnlisted: ["OLDX"],
};

const configuredEnv: KnowledgeGraphEnv = {
  ORGANON_API_URL: "https://organon.example",
  ORGANON_API_KEY: "organon_key",
};

type HarnessOptions = {
  env?: KnowledgeGraphEnv;
  loadCompanies?: (runSparql: RunSparqlSelect) => Promise<ListedCompany[]>;
  syncTickers?: (
    companies: readonly ListedCompany[],
    db: TickerSyncDb,
  ) => Promise<TickerSyncResult>;
};

const createHarness = ({
  env = configuredEnv,
  loadCompanies,
  syncTickers,
}: HarnessOptions = {}) => {
  const connections: KnowledgeGraphConnection[] = [];
  const syncCalls: { companies: readonly ListedCompany[]; db: TickerSyncDb }[] =
    [];
  const runSparql: RunSparqlSelect = async () => [];
  const loadedWith: RunSparqlSelect[] = [];
  const app = new Hono();
  app.post(
    "/sync-from-knowledge-graph",
    createSyncFromKnowledgeGraphHandler({
      confirmToken,
      readEnv: () => env,
      db: fakeDb,
      createSparqlClient: (connection) => {
        connections.push(connection);

        return runSparql;
      },
      loadCompanies:
        loadCompanies ??
        (async (runSparqlForLoad) => {
          loadedWith.push(runSparqlForLoad);

          return listedCompanies;
        }),
      syncTickers: async (companies, db) => {
        syncCalls.push({ companies, db });

        return syncTickers === undefined
          ? syncResult
          : syncTickers(companies, db);
      },
    }),
  );
  const post = (body: unknown) =>
    app.request("http://localhost/sync-from-knowledge-graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  return { post, connections, syncCalls, runSparql, loadedWith };
};

describe("createSyncFromKnowledgeGraphHandler", () => {
  it("loads the listed companies, syncs them and returns the counts", async () => {
    const harness = createHarness();

    const response = await harness.post({ confirm: confirmToken });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...syncResult, deleted: 1 });
    expect(harness.connections).toEqual([
      { baseUrl: "https://organon.example", apiKey: "organon_key" },
    ]);
    expect(harness.loadedWith).toEqual([harness.runSparql]);
    expect(harness.syncCalls).toEqual([
      { companies: listedCompanies, db: fakeDb },
    ]);
  });

  it("refuses with 409 when the sync would remove too many tickers", async () => {
    const harness = createHarness({
      syncTickers: async () => {
        throw new TickerRemovalLimitError(["AAAA", "BBBB"]);
      },
    });

    const response = await harness.post({ confirm: confirmToken });
    const body = (await response.json()) as {
      message: string;
      unlisted: string[];
    };

    expect(response.status).toBe(409);
    expect(body.unlisted).toEqual(["AAAA", "BBBB"]);
    expect(body.message).toContain("Nothing was changed.");
  });

  it("rejects a body without the confirm token before reading the env", async () => {
    const harness = createHarness();

    const response = await harness.post({ confirm: "WRONG" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "Invalid request body" });
    expect(harness.connections).toEqual([]);
  });

  it("rejects a body that is not JSON", async () => {
    const harness = createHarness();

    const response = await harness.post("not json");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "Invalid JSON" });
  });

  it.each([
    { ORGANON_API_KEY: "organon_key" },
    { ORGANON_API_URL: "https://organon.example" },
    { ORGANON_API_URL: "  ", ORGANON_API_KEY: "organon_key" },
  ])(
    "asks for both env vars when one is missing (%o)",
    async (env: KnowledgeGraphEnv) => {
      const harness = createHarness({ env });

      const response = await harness.post({ confirm: confirmToken });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        message: MISSING_KNOWLEDGE_GRAPH_ENV_MESSAGE,
      });
      expect(harness.connections).toEqual([]);
      expect(harness.syncCalls).toEqual([]);
    },
  );

  it("reports a knowledge graph failure without touching the tickers", async () => {
    const harness = createHarness({
      loadCompanies: async () => {
        throw new Error("Organon answered 503 to a SPARQL query: down");
      },
    });

    const response = await harness.post({ confirm: confirmToken });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      message:
        "Loading listed companies from the knowledge graph failed: Organon answered 503 to a SPARQL query: down",
    });
    expect(harness.syncCalls).toEqual([]);
  });
});

describe("readKnowledgeGraphConnection", () => {
  it("trims the URL and the key", () => {
    const connection = readKnowledgeGraphConnection({
      ORGANON_API_URL: " https://organon.example ",
      ORGANON_API_KEY: " organon_key ",
    });

    expect(connection).toEqual({
      baseUrl: "https://organon.example",
      apiKey: "organon_key",
    });
  });

  it("returns null when nothing is set", () => {
    const connection = readKnowledgeGraphConnection({});

    expect(connection).toBeNull();
  });
});
