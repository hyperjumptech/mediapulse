import { promises as fs } from "node:fs";
import path from "node:path";
import { logger } from "@workspace/logger";
import type { Ticker } from "./tickers";
import { tickersArraySchema } from "./tickers";

/**
 * Reads slim tickers from the public/tickers.json file.
 *
 * @param filePath - Path to the tickers JSON file (defaults to public/tickers.json in cwd).
 * @returns Array of slim tickers, or empty array if the file is missing or invalid.
 */
export const readTickers = async (
  filePath: string = path.join(process.cwd(), "public/tickers.json"),
): Promise<Ticker[]> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const result = tickersArraySchema.safeParse(parsed);
    if (!result.success) {
      logger.error(
        { err: result.error, filePath },
        "Invalid tickers.json structure",
      );
      return [];
    }
    return result.data;
  } catch (error) {
    logger.error(
      { err: error, filePath },
      "Failed to read or parse tickers.json",
    );
    return [];
  }
};
