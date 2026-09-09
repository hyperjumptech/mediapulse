/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  listUnresolvedPublishers,
  recordPublisherNames,
  upsertPublishersSeen,
} from "./publisher.js";

type PublisherRow = {
  domain: string;
  displayName: string;
  nameSource: "derived" | "llm" | "site_metadata" | "manual";
};

type PublisherDelegate = Parameters<
  typeof upsertPublishersSeen
>[1]["publisher"];

const makeDb = (rows: PublisherRow[]) => {
  const store = new Map(rows.map((row) => [row.domain, { ...row }]));
  const publisher = {
    findMany: vi.fn(async (args: { where?: { domain?: { in: string[] } } }) => {
      const wanted = args.where?.domain?.in;
      const all = [...store.values()];

      return wanted === undefined
        ? all
        : all.filter((row) => wanted.includes(row.domain));
    }),
    create: vi.fn(async (args: { data: PublisherRow }) => {
      if (store.has(args.data.domain)) {
        throw new Error("unique violation");
      }
      store.set(args.data.domain, { ...args.data });

      return args.data;
    }),
    update: vi.fn(
      async (args: {
        where: { domain: string };
        data: Partial<PublisherRow>;
      }) => {
        const existing = store.get(args.where.domain);
        if (existing === undefined) {
          throw new Error("not found");
        }
        Object.assign(existing, args.data);

        return existing;
      },
    ),
    updateMany: vi.fn(
      async (args: { where: { domain: { in: string[] } } }) => ({
        count: args.where.domain.in.filter((domain) => store.has(domain))
          .length,
      }),
    ),
  };

  return {
    store,
    publisher,
    delegate: publisher as unknown as PublisherDelegate,
  };
};

describe("upsertPublishersSeen", () => {
  it("creates a row for each domain it has not seen before", async () => {
    const db = makeDb([]);
    const result = await upsertPublishersSeen(
      [
        { domain: "kontan.co.id", displayName: "Kontan" },
        { domain: "bisnis.com", displayName: "Bisnis" },
      ],
      { publisher: db.delegate, now: new Date("2026-09-09T00:00:00.000Z") },
    );

    expect(result.createdCount).toBe(2);
    expect(db.store.get("kontan.co.id")?.nameSource).toBe("derived");
  });

  it("never overwrites the display name of an existing row", async () => {
    const db = makeDb([
      {
        domain: "thejakartapost.com",
        displayName: "The Jakarta Post",
        nameSource: "manual",
      },
    ]);
    const result = await upsertPublishersSeen(
      [{ domain: "thejakartapost.com", displayName: "Thejakartapost" }],
      { publisher: db.delegate },
    );

    expect(result.createdCount).toBe(0);
    expect(db.store.get("thejakartapost.com")?.displayName).toBe(
      "The Jakarta Post",
    );
    expect(db.publisher.update).not.toHaveBeenCalled();
  });

  it("collapses a domain repeated within one batch into a single create", async () => {
    const db = makeDb([]);
    const result = await upsertPublishersSeen(
      [
        { domain: "bisnis.com", displayName: "Bisnis" },
        { domain: "bisnis.com", displayName: "Bisnis" },
      ],
      { publisher: db.delegate },
    );

    expect(result.createdCount).toBe(1);
    expect(db.publisher.create).toHaveBeenCalledTimes(1);
  });

  it("does nothing when given no domains", async () => {
    const db = makeDb([]);
    const result = await upsertPublishersSeen([], { publisher: db.delegate });

    expect(result).toEqual({ createdCount: 0, touchedCount: 0 });
    expect(db.publisher.findMany).not.toHaveBeenCalled();
  });
});

describe("listUnresolvedPublishers", () => {
  it("asks only for rows whose name is still the derived fallback", async () => {
    const db = makeDb([]);

    await listUnresolvedPublishers(10, { publisher: db.delegate });

    expect(db.publisher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nameSource: "derived" },
        take: 10,
      }),
    );
  });
});

describe("recordPublisherNames", () => {
  it("writes a better-sourced name over a derived one", async () => {
    const db = makeDb([
      {
        domain: "bloombergtechnoz.com",
        displayName: "Bloombergtechnoz",
        nameSource: "derived",
      },
    ]);
    const result = await recordPublisherNames(
      [
        {
          domain: "bloombergtechnoz.com",
          displayName: "Bloomberg Technoz",
          nameSource: "llm",
        },
      ],
      { publisher: db.delegate },
    );

    expect(result).toEqual({ updatedCount: 1, skippedCount: 0 });
    expect(db.store.get("bloombergtechnoz.com")?.displayName).toBe(
      "Bloomberg Technoz",
    );
  });

  it("leaves a manual name alone when site metadata disagrees", async () => {
    const db = makeDb([
      {
        domain: "antaranews.com",
        displayName: "Antara",
        nameSource: "manual",
      },
    ]);
    const result = await recordPublisherNames(
      [
        {
          domain: "antaranews.com",
          displayName: "ANTARA News Agency Portal",
          nameSource: "site_metadata",
        },
      ],
      { publisher: db.delegate },
    );

    expect(result).toEqual({ updatedCount: 0, skippedCount: 1 });
    expect(db.store.get("antaranews.com")?.displayName).toBe("Antara");
  });

  it("lets a source refresh its own earlier name", async () => {
    const db = makeDb([
      {
        domain: "detik.com",
        displayName: "Detik",
        nameSource: "site_metadata",
      },
    ]);
    const result = await recordPublisherNames(
      [
        {
          domain: "detik.com",
          displayName: "detikcom",
          nameSource: "site_metadata",
        },
      ],
      { publisher: db.delegate },
    );

    expect(result.updatedCount).toBe(1);
    expect(db.store.get("detik.com")?.displayName).toBe("detikcom");
  });

  it("skips a domain that has no reference row", async () => {
    const db = makeDb([]);
    const result = await recordPublisherNames(
      [
        {
          domain: "unknown.com",
          displayName: "Unknown",
          nameSource: "llm",
        },
      ],
      { publisher: db.delegate },
    );

    expect(result).toEqual({ updatedCount: 0, skippedCount: 1 });
    expect(db.publisher.update).not.toHaveBeenCalled();
  });
});
