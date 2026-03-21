/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { prismaWriteFieldMetadata } from "../../generated/prisma-write-field-metadata";
import { buildWriteBodySchema } from "./build-write-body-schema";

describe("buildWriteBodySchema", () => {
  it("builds EntityType name and description from metadata", () => {
    // Act
    const schema = buildWriteBodySchema({
      metadata: prismaWriteFieldMetadata,
      model: "EntityType",
      fields: ["name", "description"],
    });

    // Assert
    const ok = schema.safeParse({ name: "x", description: null });
    expect(ok.success).toBe(true);
  });

  it("rejects unknown keys when strict", () => {
    // Setup
    const schema = buildWriteBodySchema({
      metadata: prismaWriteFieldMetadata,
      model: "EntityType",
      fields: ["name"],
    });

    // Act
    const bad = schema.safeParse({ name: "x", extra: 1 });

    // Assert
    expect(bad.success).toBe(false);
  });

  it("applies field overrides", () => {
    // Act
    const schema = buildWriteBodySchema({
      metadata: prismaWriteFieldMetadata,
      model: "MediapulseUser",
      fields: ["email"],
      fieldOverrides: { email: z.string().email() },
    });

    // Assert
    expect(schema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(schema.safeParse({ email: "a@b.co" }).success).toBe(true);
  });
});
