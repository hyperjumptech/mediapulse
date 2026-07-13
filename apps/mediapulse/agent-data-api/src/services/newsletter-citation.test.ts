/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    newsletterCitation: {
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

import { createNewsletterCitations } from "./newsletter-citation.js";

type FakeDb = {
  newsletterCitation: {
    create: ReturnType<typeof vi.fn>;
  };
};

const makeDb = (): FakeDb => ({
  newsletterCitation: {
    create: vi.fn().mockResolvedValue({ id: "nc-1" }),
  },
});

const asDeps = (db: FakeDb) => ({
  db: db as unknown as Parameters<typeof createNewsletterCitations>[1] extends {
    db?: infer D;
  }
    ? NonNullable<D>
    : never,
});

const NEWSLETTER_ID = "22222222-2222-4222-a222-222222222222";
const DS_ONE = "44444444-4444-4444-a444-444444444444";
const DS_TWO = "55555555-5555-4555-a555-555555555555";

describe("createNewsletterCitations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inserts one row per unique citation and returns recordedCount", async () => {
    const db = makeDb();

    const result = await createNewsletterCitations(
      {
        newsletterId: NEWSLETTER_ID,
        citations: [
          { dataSourceId: DS_ONE, sectionKey: "quickHits" },
          { dataSourceId: DS_TWO, sectionKey: "dealsAndMovements" },
        ],
      },
      asDeps(db),
    );

    expect(db.newsletterCitation.create).toHaveBeenCalledTimes(2);
    expect(db.newsletterCitation.create).toHaveBeenNthCalledWith(1, {
      data: {
        newsletterId: NEWSLETTER_ID,
        dataSourceId: DS_ONE,
        sectionKey: "quickHits",
      },
    });
    expect(result).toEqual({ recordedCount: 2 });
  });

  it("de-dupes repeated (dataSourceId, sectionKey) pairs before inserting", async () => {
    const db = makeDb();

    const result = await createNewsletterCitations(
      {
        newsletterId: NEWSLETTER_ID,
        citations: [
          { dataSourceId: DS_ONE, sectionKey: "quickHits" },
          { dataSourceId: DS_ONE, sectionKey: "quickHits" },
        ],
      },
      asDeps(db),
    );

    expect(db.newsletterCitation.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ recordedCount: 1 });
  });

  it("skips unknown dataSourceIds on foreign-key violation", async () => {
    const db = makeDb();
    db.newsletterCitation.create.mockRejectedValueOnce({ code: "P2003" });

    const result = await createNewsletterCitations(
      {
        newsletterId: NEWSLETTER_ID,
        citations: [
          { dataSourceId: DS_ONE, sectionKey: "quickHits" },
          { dataSourceId: DS_TWO, sectionKey: "quickHits" },
        ],
      },
      asDeps(db),
    );

    expect(result).toEqual({ recordedCount: 1 });
  });

  it("skips existing rows on unique violation", async () => {
    const db = makeDb();
    db.newsletterCitation.create.mockRejectedValueOnce({ code: "P2002" });

    const result = await createNewsletterCitations(
      {
        newsletterId: NEWSLETTER_ID,
        citations: [{ dataSourceId: DS_ONE, sectionKey: "quickHits" }],
      },
      asDeps(db),
    );

    expect(result).toEqual({ recordedCount: 0 });
  });
});
