/** @vitest-environment node */
import type { TickerUpsertDb } from "@mediapulse/idx-tickers-importer";
import { describe, expect, it, vi } from "vitest";

import { importIdxTickersFromRequestBody } from "./import-idx-json";

const fakeDb = {
  ticker: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
} as unknown as TickerUpsertDb;

describe("importIdxTickersFromRequestBody", () => {
  it("returns 400 when body is not an object with payloadJson", async () => {
    const result = await importIdxTickersFromRequestBody(null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.message).toBe("Invalid request body");
    }
  });

  it("returns 400 when payloadJson is missing", async () => {
    const result = await importIdxTickersFromRequestBody({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Invalid request body");
    }
  });

  it("returns 400 when payloadJson is not valid JSON", async () => {
    const result = await importIdxTickersFromRequestBody({
      payloadJson: "{",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Invalid JSON");
    }
  });

  it("returns 400 when parsed JSON is not valid IDX shape", async () => {
    const result = await importIdxTickersFromRequestBody({
      payloadJson: JSON.stringify({ data: "not-array" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Invalid IDX payload");
    }
  });

  it("imports and returns added/updated counts", async () => {
    const importIdx = vi.fn().mockResolvedValue({ added: 2, updated: 1 });

    const result = await importIdxTickersFromRequestBody(
      {
        payloadJson: JSON.stringify({
          data: [{ KodeEmiten: "AAA", NamaEmiten: "Test" }],
        }),
      },
      { importIdx, db: fakeDb },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.added).toBe(2);
      expect(result.updated).toBe(1);
    }
    expect(importIdx).toHaveBeenCalledTimes(1);
  });
});
