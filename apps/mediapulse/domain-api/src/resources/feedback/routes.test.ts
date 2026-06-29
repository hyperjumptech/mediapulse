/**
 * Route wiring for newsletter feedback: list and detail handlers.
 */

/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mediapulse/database")>();
  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      newsletterFeedback: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
      },
    },
  };
});

import { prisma } from "@mediapulse/database";

import { feedbackRoutes } from "./routes";

const row = {
  id: "fb-1",
  senderEmail: "reader@example.com",
  subject: "Loved it",
  rawBody: "Great newsletter!",
  receivedAt: new Date("2026-06-20T08:00:00.000Z"),
  graphMessageId: "graph-1",
  inReplyTo: null,
  sentiment: "positive",
  category: "praise",
  classifierModel: "claude-haiku-4-5",
  classifiedAt: new Date("2026-06-20T08:05:00.000Z"),
  userId: "user-1",
  userTickerId: "ut-1",
  newsletterId: "n-1",
  createdAt: new Date("2026-06-20T08:06:00.000Z"),
  updatedAt: new Date("2026-06-20T08:06:00.000Z"),
};

describe("feedbackRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated list items with classification labels", async () => {
    vi.mocked(prisma.newsletterFeedback.findMany).mockResolvedValue([
      row,
    ] as never);
    vi.mocked(prisma.newsletterFeedback.count).mockResolvedValue(1);

    const res = await feedbackRoutes.request("http://localhost/", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ id: string; sentiment: string; category: string }>;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe("fb-1");
    expect(body.items[0]?.sentiment).toBe("Positive");
    expect(body.items[0]?.category).toBe("Praise");
    expect(prisma.newsletterFeedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { receivedAt: "desc" },
      }),
    );
  });

  it("passes sentiment and category filters to Prisma findMany", async () => {
    vi.mocked(prisma.newsletterFeedback.findMany).mockResolvedValue(
      [] as never,
    );
    vi.mocked(prisma.newsletterFeedback.count).mockResolvedValue(0);

    const res = await feedbackRoutes.request(
      "http://localhost/?sentiment=negative&category=bug",
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    expect(prisma.newsletterFeedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ sentiment: "negative" }, { category: "bug" }] },
      }),
    );
  });

  it("ignores invalid filter values", async () => {
    vi.mocked(prisma.newsletterFeedback.findMany).mockResolvedValue(
      [] as never,
    );
    vi.mocked(prisma.newsletterFeedback.count).mockResolvedValue(0);

    const res = await feedbackRoutes.request(
      "http://localhost/?sentiment=angry&category=spam",
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    expect(prisma.newsletterFeedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
      }),
    );
  });

  it("serves table metadata at /meta without hitting the detail handler", async () => {
    const res = await feedbackRoutes.request("http://localhost/meta", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      title: string;
      columns: Array<{ key: string }>;
    };
    expect(body.title).toBe("Feedback");
    expect(body.columns.map((column) => column.key)).toContain("senderEmail");
    expect(prisma.newsletterFeedback.findUnique).not.toHaveBeenCalled();
  });

  it("returns a detail payload for an existing row", async () => {
    vi.mocked(prisma.newsletterFeedback.findUnique).mockResolvedValue(
      row as never,
    );

    const res = await feedbackRoutes.request("http://localhost/fb-1", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      title: string;
      rawBody: string;
      newsletterId: string;
    };
    expect(body.id).toBe("fb-1");
    expect(body.title).toBe("Loved it");
    expect(body.rawBody).toBe("Great newsletter!");
    expect(body.newsletterId).toBe("n-1");
  });

  it("returns 404 when the row is missing", async () => {
    vi.mocked(prisma.newsletterFeedback.findUnique).mockResolvedValue(
      null as never,
    );

    const res = await feedbackRoutes.request("http://localhost/missing", {
      method: "GET",
    });

    expect(res.status).toBe(404);
  });
});
