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
      },
    ] as never);
    vi.mocked(prisma.mediapulseUser.count).mockResolvedValue(1);

    const res = await mediapulseUsersRoutes.request("http://localhost/", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ id: string; enabled: string }>;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe("user-1");
    expect(body.items[0]?.enabled).toBe("Yes");
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
});
