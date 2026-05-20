/**
 * Route wiring for entity-relations: CRUD, meta, and reset-all custom action.
 */

/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mediapulse/database")>();
  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      entity: {
        findMany: vi.fn(),
      },
      relationType: {
        findUnique: vi.fn(),
      },
      entityRelation: {
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
import { entityRelationsResetAllConfirmToken } from "./custom-actions";
import { entityRelationsRoutes } from "./routes";

const setupResolvedEntities = () => {
  vi.mocked(prisma.entity.findMany)
    .mockResolvedValueOnce([{ id: "from-1" }] as never)
    .mockResolvedValueOnce([{ id: "to-1" }] as never);
  vi.mocked(prisma.relationType.findUnique).mockResolvedValue({
    id: "rt-1",
  } as never);
};

describe("entityRelationsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves GET /meta with table-v1 meta JSON", async () => {
    // Act
    const res = await entityRelationsRoutes.request("http://localhost/meta", {
      method: "GET",
    });

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { title?: string; actions?: unknown };
    expect(body.title).toBe("Entity relations");
    expect(body.actions).toEqual({
      create: true,
      update: true,
      delete: true,
      view: true,
    });
  });

  it("creates an entity relation and returns 201", async () => {
    // Setup
    setupResolvedEntities();
    vi.mocked(prisma.entityRelation.create).mockResolvedValue({
      id: "rel-1",
    } as never);

    // Act
    const res = await entityRelationsRoutes.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromEntityName: "Apple Inc.",
        toEntityName: "Tim Cook",
        relationTypeName: "CEO_OF",
        weight: 1,
      }),
    });

    // Assert
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("rel-1");
  });

  it("returns 409 when create hits a unique constraint", async () => {
    // Setup
    setupResolvedEntities();
    vi.mocked(prisma.entityRelation.create).mockRejectedValue({
      code: "P2002",
    });

    // Act
    const res = await entityRelationsRoutes.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromEntityName: "Apple Inc.",
        toEntityName: "Tim Cook",
        relationTypeName: "CEO_OF",
        weight: 1,
      }),
    });

    // Assert
    expect(res.status).toBe(409);
  });

  it("returns 400 when an entity name cannot be resolved", async () => {
    // Setup
    vi.mocked(prisma.entity.findMany).mockResolvedValue([] as never);

    // Act
    const res = await entityRelationsRoutes.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromEntityName: "Missing",
        toEntityName: "Tim Cook",
        relationTypeName: "CEO_OF",
        weight: 1,
      }),
    });

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toContain("Entity not found");
  });

  it("updates an entity relation", async () => {
    // Setup
    setupResolvedEntities();
    vi.mocked(prisma.entityRelation.update).mockResolvedValue({
      id: "rel-1",
    } as never);

    // Act
    const res = await entityRelationsRoutes.request("http://localhost/rel-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromEntityName: "Apple Inc.",
        toEntityName: "Tim Cook",
        relationTypeName: "CEO_OF",
        weight: 2,
      }),
    });

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("rel-1");
  });

  it("returns 404 when update target is missing", async () => {
    // Setup
    setupResolvedEntities();
    vi.mocked(prisma.entityRelation.update).mockRejectedValue({
      code: "P2025",
    });

    // Act
    const res = await entityRelationsRoutes.request(
      "http://localhost/missing",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromEntityName: "Apple Inc.",
          toEntityName: "Tim Cook",
          relationTypeName: "CEO_OF",
          weight: 1,
        }),
      },
    );

    // Assert
    expect(res.status).toBe(404);
  });

  it("returns 409 when update hits a unique constraint", async () => {
    // Setup
    setupResolvedEntities();
    vi.mocked(prisma.entityRelation.update).mockRejectedValue({
      code: "P2002",
    });

    // Act
    const res = await entityRelationsRoutes.request("http://localhost/rel-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromEntityName: "Apple Inc.",
        toEntityName: "Tim Cook",
        relationTypeName: "CEO_OF",
        weight: 1,
      }),
    });

    // Assert
    expect(res.status).toBe(409);
  });

  it("deletes an entity relation by id", async () => {
    // Setup
    vi.mocked(prisma.entityRelation.deleteMany).mockResolvedValue({
      count: 1,
    });

    // Act
    const res = await entityRelationsRoutes.request("http://localhost/rel-1", {
      method: "DELETE",
    });

    // Assert
    expect(res.status).toBe(200);
    expect(prisma.entityRelation.deleteMany).toHaveBeenCalledWith({
      where: { id: "rel-1" },
    });
  });

  it("returns 404 when delete target is missing", async () => {
    // Setup
    vi.mocked(prisma.entityRelation.deleteMany).mockResolvedValue({
      count: 0,
    });

    // Act
    const res = await entityRelationsRoutes.request(
      "http://localhost/missing",
      {
        method: "DELETE",
      },
    );

    // Assert
    expect(res.status).toBe(404);
  });

  it("reset-all deletes every relation when confirm token matches", async () => {
    // Setup
    vi.mocked(prisma.entityRelation.deleteMany).mockResolvedValue({
      count: 5,
    });

    // Act
    const res = await entityRelationsRoutes.request(
      "http://localhost/reset-all",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: entityRelationsResetAllConfirmToken,
        }),
      },
    );

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { deleted: number };
    expect(body.deleted).toBe(5);
    expect(prisma.entityRelation.deleteMany).toHaveBeenCalledWith({});
  });

  it("returns 400 when reset-all confirm token is wrong", async () => {
    // Act
    const res = await entityRelationsRoutes.request(
      "http://localhost/reset-all",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "NOPE" }),
      },
    );

    // Assert
    expect(res.status).toBe(400);
    expect(prisma.entityRelation.deleteMany).not.toHaveBeenCalled();
  });
});
