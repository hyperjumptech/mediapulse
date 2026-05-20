/**
 * Unit tests for entity-relation endpoint name resolution.
 */

/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveEntityIdByCanonicalName,
  resolveEntityRelationEndpointIds,
  resolveRelationTypeIdByName,
} from "./resolve-entity-relation-endpoints";

describe("resolveEntityIdByCanonicalName", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the id when exactly one entity matches", async () => {
    // Setup
    const findMany = vi.fn().mockResolvedValue([{ id: "e-1" }]);

    // Act
    const result = await resolveEntityIdByCanonicalName(
      { findMany },
      "Apple Inc.",
    );

    // Assert
    expect(result).toEqual({ ok: true, id: "e-1" });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        canonicalName: { equals: "Apple Inc.", mode: "insensitive" },
      },
      select: { id: true },
    });
  });

  it("returns an error when no entity matches", async () => {
    // Setup
    const findMany = vi.fn().mockResolvedValue([]);

    // Act
    const result = await resolveEntityIdByCanonicalName(
      { findMany },
      "Missing Co.",
    );

    // Assert
    expect(result).toEqual({
      ok: false,
      message: "Entity not found: Missing Co.",
    });
  });

  it("returns an error when multiple entities match", async () => {
    // Setup
    const findMany = vi.fn().mockResolvedValue([{ id: "e-1" }, { id: "e-2" }]);

    // Act
    const result = await resolveEntityIdByCanonicalName(
      { findMany },
      "Duplicate",
    );

    // Assert
    expect(result).toEqual({
      ok: false,
      message: "Ambiguous entity name: Duplicate",
    });
  });
});

describe("resolveRelationTypeIdByName", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the id when the relation type exists", async () => {
    // Setup
    const findUnique = vi.fn().mockResolvedValue({ id: "rt-1" });

    // Act
    const result = await resolveRelationTypeIdByName({ findUnique }, "CEO_OF");

    // Assert
    expect(result).toEqual({ ok: true, id: "rt-1" });
    expect(findUnique).toHaveBeenCalledWith({
      where: { name: "CEO_OF" },
      select: { id: true },
    });
  });

  it("returns an error when the relation type is missing", async () => {
    // Setup
    const findUnique = vi.fn().mockResolvedValue(null);

    // Act
    const result = await resolveRelationTypeIdByName({ findUnique }, "UNKNOWN");

    // Assert
    expect(result).toEqual({
      ok: false,
      message: "Relation type not found: UNKNOWN",
    });
  });
});

describe("resolveEntityRelationEndpointIds", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns all resolved ids when every name is valid", async () => {
    // Setup
    const entityFindMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: "from-1" }])
      .mockResolvedValueOnce([{ id: "to-1" }]);
    const relationTypeFindUnique = vi.fn().mockResolvedValue({ id: "rt-1" });

    // Act
    const result = await resolveEntityRelationEndpointIds(
      {
        entity: { findMany: entityFindMany },
        relationType: { findUnique: relationTypeFindUnique },
      },
      {
        fromEntityName: "Apple Inc.",
        toEntityName: "Tim Cook",
        relationTypeName: "CEO_OF",
      },
    );

    // Assert
    expect(result).toEqual({
      ok: true,
      ids: {
        fromEntityId: "from-1",
        toEntityId: "to-1",
        relationTypeId: "rt-1",
      },
    });
  });

  it("returns the first resolution error", async () => {
    // Setup
    const entityFindMany = vi.fn().mockResolvedValue([]);

    // Act
    const result = await resolveEntityRelationEndpointIds(
      {
        entity: { findMany: entityFindMany },
        relationType: { findUnique: vi.fn() },
      },
      {
        fromEntityName: "Missing",
        toEntityName: "Tim Cook",
        relationTypeName: "CEO_OF",
      },
    );

    // Assert
    expect(result).toEqual({
      ok: false,
      message: "Entity not found: Missing",
    });
  });
});
