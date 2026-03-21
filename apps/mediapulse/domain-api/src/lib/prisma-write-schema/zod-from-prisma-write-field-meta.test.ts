/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { z as zodBuilder } from "zod";

import { zodFromPrismaWriteFieldMeta } from "./zod-from-prisma-write-field-meta";

describe("zodFromPrismaWriteFieldMeta", () => {
  const getEnumSchema = () => undefined;

  it("builds required non-empty string", () => {
    // Act
    const schema = zodFromPrismaWriteFieldMeta(
      { kind: "scalar", type: "String", isRequired: true, isList: false },
      { getEnumSchema },
    );

    // Assert
    expect(schema.safeParse("").success).toBe(false);
    expect(schema.safeParse("a").success).toBe(true);
  });

  it("builds optional nullable string", () => {
    // Act
    const schema = zodFromPrismaWriteFieldMeta(
      { kind: "scalar", type: "String", isRequired: false, isList: false },
      { getEnumSchema },
    );

    // Assert
    expect(schema.safeParse(undefined).success).toBe(true);
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse("x").success).toBe(true);
  });

  it("builds int and float", () => {
    // Act
    const zi = zodFromPrismaWriteFieldMeta(
      { kind: "scalar", type: "Int", isRequired: true, isList: false },
      { getEnumSchema },
    );
    const zf = zodFromPrismaWriteFieldMeta(
      { kind: "scalar", type: "Float", isRequired: true, isList: false },
      { getEnumSchema },
    );

    // Assert
    expect(zi.safeParse(3).success).toBe(true);
    expect(zi.safeParse(3.1).success).toBe(false);
    expect(zf.safeParse(3.1).success).toBe(true);
  });

  it("throws for list fields", () => {
    // Act & Assert
    expect(() =>
      zodFromPrismaWriteFieldMeta(
        { kind: "scalar", type: "String", isRequired: true, isList: true },
        { getEnumSchema },
      ),
    ).toThrow(/list fields are not supported/);
  });

  it("uses enum resolver", () => {
    // Setup
    const getEnum = () => zodBuilder.enum(["A", "B"]);

    // Act
    const schema = zodFromPrismaWriteFieldMeta(
      { kind: "enum", enumName: "E", isRequired: true, isList: false },
      { getEnumSchema: getEnum },
    );

    // Assert
    expect(schema.safeParse("A").success).toBe(true);
    expect(schema.safeParse("C").success).toBe(false);
  });

  it("throws when enum is missing from registry", () => {
    // Act & Assert
    expect(() =>
      zodFromPrismaWriteFieldMeta(
        { kind: "enum", enumName: "Missing", isRequired: true, isList: false },
        { getEnumSchema: () => undefined },
      ),
    ).toThrow(/No Zod schema registered/);
  });
});
