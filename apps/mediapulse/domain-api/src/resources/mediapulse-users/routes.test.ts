/**
 * Route wiring for mediapulse-users: list and CRUD handlers.
 */

/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mediapulse/database")>();
  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      mediapulseUser: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
  };
});

import { prisma } from "@mediapulse/database";

import { mediapulseUsersRoutes } from "./routes";

const detailRow = {
  id: "user-1",
  email: "a@example.com",
  name: "Ada",
  enabled: true,
  createdAt: new Date("2026-06-17T10:00:00.000Z"),
  updatedAt: new Date("2026-06-17T10:00:00.000Z"),
  userTickers: [
    {
      id: "ut-1",
      userId: "user-1",
      tickerId: "ticker-1",
      enabled: true,
      language: "en" as const,
      registrationConfirmedAt: new Date("2026-06-17T11:00:00.000Z"),
      unsubscribedAt: null,
      unsubscribeMethod: null,
      createdAt: new Date("2026-06-17T10:30:00.000Z"),
      updatedAt: new Date("2026-06-17T10:30:00.000Z"),
      ticker: { symbol: "BBRI", name: "Bank Rakyat Indonesia" },
    },
  ],
};

describe("mediapulseUsersRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated list items", async () => {
    vi.mocked(prisma.mediapulseUser.findMany).mockResolvedValue([
      {
        id: "user-1",
        email: "a@example.com",
        name: "Ada",
        enabled: true,
        createdAt: new Date("2026-06-17T10:00:00.000Z"),
        updatedAt: new Date("2026-06-17T10:00:00.000Z"),
        userTickers: [{ language: "en" }],
      },
    ] as never);
    vi.mocked(prisma.mediapulseUser.count).mockResolvedValue(1);

    const res = await mediapulseUsersRoutes.request("http://localhost/", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ id: string; enabled: string; languages: string }>;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe("user-1");
    expect(body.items[0]?.enabled).toBe("Yes");
    expect(body.items[0]?.languages).toBe("English");
    expect(prisma.mediapulseUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { userTickers: { select: { language: true } } },
      }),
    );
  });

  it("passes enabled filter to Prisma findMany", async () => {
    vi.mocked(prisma.mediapulseUser.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.mediapulseUser.count).mockResolvedValue(0);

    const res = await mediapulseUsersRoutes.request(
      "http://localhost/?enabled=false",
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    expect(prisma.mediapulseUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enabled: false },
      }),
    );
  });

  it("passes language filter to Prisma findMany", async () => {
    vi.mocked(prisma.mediapulseUser.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.mediapulseUser.count).mockResolvedValue(0);

    const res = await mediapulseUsersRoutes.request(
      "http://localhost/?language=en",
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    expect(prisma.mediapulseUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userTickers: { some: { language: "en" } } },
      }),
    );
  });

  it("ignores invalid language filter values", async () => {
    vi.mocked(prisma.mediapulseUser.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.mediapulseUser.count).mockResolvedValue(0);

    const res = await mediapulseUsersRoutes.request(
      "http://localhost/?language=fr",
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    expect(prisma.mediapulseUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
      }),
    );
  });

  it("persists enabled on PATCH", async () => {
    vi.mocked(prisma.mediapulseUser.update).mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      name: "Ada",
      enabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await mediapulseUsersRoutes.request("http://localhost/user-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "a@example.com",
        name: "Ada",
        enabled: false,
      }),
    });

    expect(res.status).toBe(200);
    expect(prisma.mediapulseUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enabled: false }),
      }),
    );
  });

  it("returns a detail payload with subscriptions for an existing user", async () => {
    vi.mocked(prisma.mediapulseUser.findUnique).mockResolvedValue(
      detailRow as never,
    );

    const res = await mediapulseUsersRoutes.request("http://localhost/user-1", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      email: string;
      subscriptions: Array<{ tickerSymbol: string; language: string }>;
    };
    expect(body.id).toBe("user-1");
    expect(body.email).toBe("a@example.com");
    expect(body.subscriptions).toHaveLength(1);
    expect(body.subscriptions[0]?.tickerSymbol).toBe("BBRI");
    expect(body.subscriptions[0]?.language).toBe("English");
    expect(prisma.mediapulseUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        include: {
          userTickers: {
            include: { ticker: { select: { symbol: true, name: true } } },
            orderBy: [{ ticker: { symbol: "asc" } }, { language: "asc" }],
          },
        },
      }),
    );
  });

  it("returns 404 when the user is missing on GET /:id", async () => {
    vi.mocked(prisma.mediapulseUser.findUnique).mockResolvedValue(
      null as never,
    );

    const res = await mediapulseUsersRoutes.request(
      "http://localhost/missing",
      {
        method: "GET",
      },
    );

    expect(res.status).toBe(404);
  });
});
