/**
 * Unit tests for entity-relation write body schemas.
 */

/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  entityRelationCreateBodySchema,
  entityRelationUpdateBodySchema,
} from "./write-body-schemas";

describe("entityRelationCreateBodySchema", () => {
  it("accepts a valid write body", () => {
    // Setup
    const body = {
      fromEntityName: "Apple Inc.",
      toEntityName: "Tim Cook",
      relationTypeName: "CEO_OF",
      weight: 1.5,
    };

    // Act
    const parsed = entityRelationCreateBodySchema.safeParse(body);

    // Assert
    expect(parsed.success).toBe(true);
  });

  it("rejects empty from entity name", () => {
    // Act
    const parsed = entityRelationCreateBodySchema.safeParse({
      fromEntityName: "   ",
      toEntityName: "Tim Cook",
      relationTypeName: "CEO_OF",
      weight: 1,
    });

    // Assert
    expect(parsed.success).toBe(false);
  });

  it("rejects non-positive weight", () => {
    // Act
    const parsed = entityRelationCreateBodySchema.safeParse({
      fromEntityName: "Apple Inc.",
      toEntityName: "Tim Cook",
      relationTypeName: "CEO_OF",
      weight: 0,
    });

    // Assert
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown keys", () => {
    // Act
    const parsed = entityRelationCreateBodySchema.safeParse({
      fromEntityName: "Apple Inc.",
      toEntityName: "Tim Cook",
      relationTypeName: "CEO_OF",
      weight: 1,
      extra: true,
    });

    // Assert
    expect(parsed.success).toBe(false);
  });
});

describe("entityRelationUpdateBodySchema", () => {
  it("uses the same shape as create", () => {
    // Assert
    expect(entityRelationUpdateBodySchema).toBe(entityRelationCreateBodySchema);
  });
});
