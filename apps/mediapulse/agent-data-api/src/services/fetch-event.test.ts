/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    fetchEvent: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@workspace/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { createFetchEvents } from "./fetch-event.js";

type FakeDb = {
  fetchEvent: {
    create: ReturnType<typeof vi.fn>;
  };
};

const makeDb = (): FakeDb => ({
  fetchEvent: {
    create: vi.fn().mockResolvedValue({ id: "fe-1" }),
  },
});

const asDeps = (db: FakeDb) => ({
  db: db as unknown as Parameters<typeof createFetchEvents>[1] extends {
    db?: infer D;
  }
    ? NonNullable<D>
    : never,
});

describe("createFetchEvents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inserts one row per event and returns recordedCount", async () => {
    const db = makeDb();

    const result = await createFetchEvents(
      [
        {
          dataSourceId: "44444444-4444-4444-a444-444444444444",
          tickerId: "ticker-bca",
          reason: "description too thin",
          provider: "serper",
          status: "succeeded",
        },
        {
          dataSourceId: "55555555-5555-4555-a555-555555555555",
          tickerId: "ticker-bca",
          reason: "no body",
          status: "fetch_failed",
        },
      ],
      asDeps(db),
    );

    expect(db.fetchEvent.create).toHaveBeenCalledTimes(2);
    expect(db.fetchEvent.create).toHaveBeenNthCalledWith(1, {
      data: {
        dataSourceId: "44444444-4444-4444-a444-444444444444",
        tickerId: "ticker-bca",
        reason: "description too thin",
        provider: "serper",
        status: "succeeded",
      },
    });
    expect(db.fetchEvent.create).toHaveBeenNthCalledWith(2, {
      data: {
        dataSourceId: "55555555-5555-4555-a555-555555555555",
        tickerId: "ticker-bca",
        reason: "no body",
        provider: null,
        status: "fetch_failed",
      },
    });
    expect(result).toEqual({ recordedCount: 2 });
  });

  it("skips a failing insert without aborting the batch", async () => {
    const db = makeDb();
    db.fetchEvent.create
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ id: "fe-2" });

    const result = await createFetchEvents(
      [
        {
          dataSourceId: "44444444-4444-4444-a444-444444444444",
          tickerId: "ticker-bca",
          reason: "first",
          status: "gate_dropped",
        },
        {
          dataSourceId: "55555555-5555-4555-a555-555555555555",
          tickerId: "ticker-bca",
          reason: "second",
          provider: "tavily",
          status: "succeeded",
        },
      ],
      asDeps(db),
    );

    expect(result).toEqual({ recordedCount: 1 });
  });
});
