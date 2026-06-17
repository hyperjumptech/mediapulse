/**
 * Route wiring for curated-sources: meta, list, detail, and CRUD handlers.
 */

/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mediapulse/database")>();
  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      curatedSource: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
  };
});

import { prisma } from "@mediapulse/database";

import { curatedSourcesRoutes } from "./routes";

describe("curatedSourcesRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves GET /meta with table-v1 meta JSON", async () => {
    const res = await curatedSourcesRoutes.request("http://localhost/meta", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { title?: string };
    expect(body.title).toBe("Curated Sources");
  });

  it("returns paginated list items", async () => {
    vi.mocked(prisma.curatedSource.findMany).mockResolvedValue([
      {
        id: "source-1",
        name: "Example feed",
        listingUrl: "https://example.com/feed.xml",
        linkType: "listing",
        enabled: true,
        maxItems: 25,
        createdAt: new Date("2026-06-17T10:00:00.000Z"),
        updatedAt: new Date("2026-06-17T10:00:00.000Z"),
      },
    ] as never);
    vi.mocked(prisma.curatedSource.count).mockResolvedValue(1);

    const res = await curatedSourcesRoutes.request("http://localhost/", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe("source-1");
  });

  it("passes enabled filter to Prisma findMany", async () => {
    vi.mocked(prisma.curatedSource.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.curatedSource.count).mockResolvedValue(0);

    const res = await curatedSourcesRoutes.request(
      "http://localhost/?enabled=true",
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    expect(prisma.curatedSource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enabled: true },
      }),
    );
  });

  it("returns 404 when detail row is missing", async () => {
    vi.mocked(prisma.curatedSource.findUnique).mockResolvedValue(null);

    const res = await curatedSourcesRoutes.request(
      "http://localhost/missing-id",
      { method: "GET" },
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 when create body is invalid", async () => {
    const res = await curatedSourcesRoutes.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingUrl: "" }),
    });

    expect(res.status).toBe(400);
  });

  it("creates a curated source with valid body", async () => {
    vi.mocked(prisma.curatedSource.create).mockResolvedValue({
      id: "source-new",
      name: null,
      listingUrl: "https://example.com/rss",
      linkType: "listing",
      enabled: true,
      maxItems: null,
      createdAt: new Date("2026-06-17T10:00:00.000Z"),
      updatedAt: new Date("2026-06-17T10:00:00.000Z"),
    } as never);

    const res = await curatedSourcesRoutes.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingUrl: "https://example.com/rss",
        linkType: "listing",
        enabled: true,
      }),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "source-new" });
    expect(prisma.curatedSource.create).toHaveBeenCalledWith({
      data: {
        name: null,
        listingUrl: "https://example.com/rss",
        linkType: "listing",
        enabled: true,
        maxItems: null,
      },
    });
  });

  it("creates a page-type curated source", async () => {
    vi.mocked(prisma.curatedSource.create).mockResolvedValue({
      id: "source-page",
      name: "Single article",
      listingUrl: "https://example.com/article/one",
      linkType: "page",
      enabled: true,
      maxItems: null,
      createdAt: new Date("2026-06-17T10:00:00.000Z"),
      updatedAt: new Date("2026-06-17T10:00:00.000Z"),
    } as never);

    const res = await curatedSourcesRoutes.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingUrl: "https://example.com/article/one",
        linkType: "page",
        enabled: true,
      }),
    });

    expect(res.status).toBe(201);
    expect(prisma.curatedSource.create).toHaveBeenCalledWith({
      data: {
        name: null,
        listingUrl: "https://example.com/article/one",
        linkType: "page",
        enabled: true,
        maxItems: null,
      },
    });
  });
});
