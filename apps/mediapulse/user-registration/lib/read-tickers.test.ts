import { describe, expect, it, vi, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { readTickers } from "./read-tickers";
import { logger } from "@workspace/logger";

vi.mock("@workspace/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("readTickers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("returns parsed tickers from a valid JSON file", async () => {
    // Setup
    const tickers = [
      { KodeEmiten: "AADI", NamaEmiten: "PT Adaro Andalan Indonesia Tbk" },
      { KodeEmiten: "BBCA", NamaEmiten: "Bank Central Asia Tbk" },
    ];

    const tmpFile = path.join(os.tmpdir(), `tickers-test-${Date.now()}.json`);

    await fs.writeFile(tmpFile, JSON.stringify(tickers), "utf8");

    // Act
    const result = await readTickers(tmpFile);

    // Assert
    expect(result).toEqual(tickers);

    await fs.unlink(tmpFile);
  });

  it("returns empty array when the file does not exist", async () => {
    // Act
    const result = await readTickers("/non/existent/path/tickers.json");

    // Assert
    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: "/non/existent/path/tickers.json",
      }),
      "Failed to read or parse tickers.json",
    );
  });

  it("returns empty array when the file contains invalid JSON", async () => {
    // Setup
    const tmpFile = path.join(
      os.tmpdir(),
      `tickers-invalid-${Date.now()}.json`,
    );

    await fs.writeFile(tmpFile, "not valid json", "utf8");

    // Act
    const result = await readTickers(tmpFile);

    // Assert
    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: tmpFile,
      }),
      "Failed to read or parse tickers.json",
    );

    await fs.unlink(tmpFile);
  });

  it("returns empty array when JSON has invalid ticker shape", async () => {
    // Setup: valid JSON but ticker missing required fields
    const tmpFile = path.join(
      os.tmpdir(),
      `tickers-bad-shape-${Date.now()}.json`,
    );
    await fs.writeFile(
      tmpFile,
      JSON.stringify([{ KodeEmiten: "AADI" }]),
      "utf8",
    );

    // Act
    const result = await readTickers(tmpFile);

    // Assert
    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: tmpFile,
        err: expect.anything(),
      }),
      "Invalid tickers.json structure",
    );

    await fs.unlink(tmpFile);
  });
});
