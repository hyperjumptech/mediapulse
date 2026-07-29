/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    newsletterSection: {
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

import { createNewsletterSections } from "./newsletter-section.js";

type FakeDb = {
  newsletterSection: {
    create: ReturnType<typeof vi.fn>;
  };
};

const makeDb = (): FakeDb => ({
  newsletterSection: {
    create: vi.fn().mockResolvedValue({ id: "ns-1" }),
  },
});

const asDeps = (db: FakeDb) => ({
  db: db as unknown as Parameters<typeof createNewsletterSections>[1] extends {
    db?: infer D;
  }
    ? NonNullable<D>
    : never,
});

const NEWSLETTER_ID = "22222222-2222-4222-a222-222222222222";
const DS_ONE = "44444444-4444-4444-a444-444444444444";

describe("createNewsletterSections", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates one section per entry with its nested items", async () => {
    const db = makeDb();

    const result = await createNewsletterSections(
      {
        newsletterId: NEWSLETTER_ID,
        sections: [
          {
            sectionKey: "industryPulse",
            heading: "Telkom Leads",
            summary: "Sector recap.",
            position: 0,
            items: [],
          },
          {
            sectionKey: "dealsAndMovements",
            heading: "Big Deals",
            summary: null,
            position: 1,
            items: [
              {
                title: "Rp22T Dividend",
                points: ["Record payout."],
                url: "https://reuters.com/d",
                dataSourceId: DS_ONE,
                position: 0,
              },
            ],
          },
        ],
      },
      asDeps(db),
    );

    expect(db.newsletterSection.create).toHaveBeenCalledTimes(2);
    expect(db.newsletterSection.create).toHaveBeenNthCalledWith(2, {
      data: {
        newsletterId: NEWSLETTER_ID,
        sectionKey: "dealsAndMovements",
        heading: "Big Deals",
        summary: null,
        position: 1,
        items: {
          create: [
            {
              title: "Rp22T Dividend",
              points: ["Record payout."],
              url: "https://reuters.com/d",
              dataSourceId: DS_ONE,
              position: 0,
            },
          ],
        },
      },
    });
    expect(result).toEqual({ recordedSectionCount: 2 });
  });

  it("skips a section on foreign-key violation and records the rest", async () => {
    const db = makeDb();
    db.newsletterSection.create.mockRejectedValueOnce({ code: "P2003" });

    const result = await createNewsletterSections(
      {
        newsletterId: NEWSLETTER_ID,
        sections: [
          {
            sectionKey: "industryPulse",
            heading: "A",
            summary: null,
            position: 0,
            items: [],
          },
          {
            sectionKey: "quickHits",
            heading: "B",
            summary: null,
            position: 1,
            items: [],
          },
        ],
      },
      asDeps(db),
    );

    expect(result).toEqual({ recordedSectionCount: 1 });
  });
});
