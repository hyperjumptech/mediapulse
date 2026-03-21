import { prisma } from "@mediapulse/database";
import {
  importIdxTickers,
  type TickerUpsertDb,
} from "@mediapulse/idx-tickers-importer";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import {
  getDashboardSession,
  getDashboardSessionForRoute,
} from "@/lib/auth-dashboard";

/** Zod schema for IDX payload: at least data array with KodeEmiten and NamaEmiten per row. */
const idxPayloadSchema = z.object({
  data: z.array(
    z
      .object({
        KodeEmiten: z.string(),
        NamaEmiten: z.string(),
      })
      .passthrough(),
  ),
});

const bodyValidator = z.object({
  payloadJson: z.string().min(1, "Payload JSON is required"),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  added: z.number(),
  updated: z.number(),
});

type ImportTickersHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  importIdx?: typeof importIdxTickers;
  db?: typeof prisma;
};

type ImportTickersHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the import-tickers handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession, importIdx, and db.
 * @returns Handler that parses JSON payload, runs import, and returns added/updated counts.
 */
export const createImportTickersHandler = ({
  getSession = getDashboardSession,
  importIdx = importIdxTickers,
  db = prisma,
}: ImportTickersHandlerDependencies = {}): ImportTickersHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(data.body.payloadJson) as unknown;
    } catch {
      return errorResponse("Invalid JSON");
    }

    const parseResult = idxPayloadSchema.safeParse(parsed);
    if (!parseResult.success) {
      return errorResponse(
        "Invalid IDX payload: data array with KodeEmiten and NamaEmiten required",
      );
    }

    const { added, updated } = await importIdx(
      parseResult.data,
      db as unknown as TickerUpsertDb,
    );

    return successResponse({ added, updated });
  };
};

/**
 * Handles import tickers: validates session, parses and validates payload, runs import, returns counts.
 */
export const handler: ImportTickersHandler = createImportTickersHandler();
