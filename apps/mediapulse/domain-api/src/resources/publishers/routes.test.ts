/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mediapulse/database")>();
  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      publisher: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

import { prisma, Prisma } from "@mediapulse/database";

import { publishersRoutes } from "./routes";

const batamPosRow = {
  id: "publisher-1",
  domain: "batampos.co.id",
  displayName: "Metropolis",
  nameSource: "site_metadata" as const,
  lastSeenAt: new Date("2026-10-03T17:53:42.000Z"),
  createdAt: new Date("2026-09-09T00:00:00.000Z"),
  updatedAt: new Date("2026-10-03T17:53:42.000Z"),
};

const patchDisplayName = (id: string, body: unknown) =>
  publishersRoutes.request(`http://localhost/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("publishersRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves GET /meta with the Publishers title", async () => {
    const response = await publishersRoutes.request("http://localhost/meta");
    const body = (await response.json()) as { title?: string };

    expect(response.status).toBe(200);
    expect(body.title).toBe("Publishers");
  });

  it("lists publishers with a readable name source", async () => {
    vi.mocked(prisma.publisher.findMany).mockResolvedValue([batamPosRow]);
    vi.mocked(prisma.publisher.count).mockResolvedValue(1);

    const response = await publishersRoutes.request("http://localhost/");
    const body = (await response.json()) as {
      items: Array<{ domain: string; nameSourceLabel: string }>;
      total: number;
    };

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({
      domain: "batampos.co.id",
      nameSourceLabel: "Site metadata",
    });
  });

  it("filters on a known name source and ignores an unknown one", async () => {
    vi.mocked(prisma.publisher.findMany).mockResolvedValue([]);
    vi.mocked(prisma.publisher.count).mockResolvedValue(0);

    await publishersRoutes.request("http://localhost/?nameSource=manual");
    await publishersRoutes.request("http://localhost/?nameSource=bogus");

    expect(prisma.publisher.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { nameSource: "manual" } }),
    );
    expect(prisma.publisher.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: {} }),
    );
  });

  it("returns 404 when the publisher is missing", async () => {
    vi.mocked(prisma.publisher.findUnique).mockResolvedValue(null);

    const response = await publishersRoutes.request("http://localhost/missing");

    expect(response.status).toBe(404);
  });

  it("saves an edited name at manual rank so no agent overwrites it", async () => {
    vi.mocked(prisma.publisher.update).mockResolvedValue({
      ...batamPosRow,
      displayName: "Batam Pos",
      nameSource: "manual",
    });

    const response = await patchDisplayName("publisher-1", {
      displayName: "  Batam   Pos ",
    });

    expect(response.status).toBe(200);
    expect(prisma.publisher.update).toHaveBeenCalledWith({
      where: { id: "publisher-1" },
      data: { displayName: "Batam Pos", nameSource: "manual" },
    });
  });

  it("rejects a blank name and any field other than the name", async () => {
    const blank = await patchDisplayName("publisher-1", { displayName: " " });
    const extraField = await patchDisplayName("publisher-1", {
      displayName: "Batam Pos",
      nameSource: "llm",
    });

    expect(blank.status).toBe(400);
    expect(extraField.status).toBe(400);
    expect(prisma.publisher.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the edited publisher no longer exists", async () => {
    vi.mocked(prisma.publisher.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "test",
      }),
    );

    const response = await patchDisplayName("missing", {
      displayName: "Batam Pos",
    });

    expect(response.status).toBe(404);
  });
});
