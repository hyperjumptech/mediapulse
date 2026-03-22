/**
 * Validates IDX JSON request bodies and runs `@mediapulse/idx-tickers-importer` upserts for the custom import action.
 */

import {
  importIdxTickers,
  type TickerUpsertDb,
} from "@mediapulse/idx-tickers-importer";
import { prisma } from "@mediapulse/database";
import { z } from "zod";

/** Zod schema for IDX payload: `data` array with required emiten fields per row. */
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

const importBodySchema = z.object({
  payloadJson: z.string().min(1, "Payload JSON is required"),
});

export type ImportIdxTickersJsonDependencies = {
  importIdx?: typeof importIdxTickers;
  db?: TickerUpsertDb;
};

export type ImportIdxTickersJsonResult =
  | { ok: true; added: number; updated: number }
  | { ok: false; status: 400; message: string };

/**
 * Parses a JSON request body, validates IDX shape, and imports tickers into the DB.
 *
 * @param body - Unknown parsed JSON body (expects `{ payloadJson: string }`).
 * @param dependencies - Optional `importIdx` and `db` for testing.
 * @returns Success with counts or failure with HTTP status and message.
 */
export const importIdxTickersFromRequestBody = async (
  body: unknown,
  dependencies: ImportIdxTickersJsonDependencies = {},
): Promise<ImportIdxTickersJsonResult> => {
  const parseBody = importBodySchema.safeParse(body);
  if (!parseBody.success) {
    return {
      ok: false,
      status: 400,
      message: "Invalid request body",
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(parseBody.data.payloadJson) as unknown;
  } catch {
    return { ok: false, status: 400, message: "Invalid JSON" };
  }

  const parsePayload = idxPayloadSchema.safeParse(parsedJson);
  if (!parsePayload.success) {
    return {
      ok: false,
      status: 400,
      message:
        "Invalid IDX payload: data array with KodeEmiten and NamaEmiten required",
    };
  }

  const importIdx = dependencies.importIdx ?? importIdxTickers;
  const db = (dependencies.db ?? prisma) as unknown as TickerUpsertDb;

  const { added, updated } = await importIdx(parsePayload.data, db);

  return { ok: true, added, updated };
};
