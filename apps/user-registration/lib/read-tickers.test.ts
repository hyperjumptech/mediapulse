import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { readTickers } from "./read-tickers";

describe("readTickers", () => {
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

    await fs.unlink(tmpFile);
  });
});
