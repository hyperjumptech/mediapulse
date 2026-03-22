import { describe, expect, it } from "vitest";
import { z } from "zod";

import { zFormBoolean } from "./form-boolean-schema";

describe("zFormBoolean", () => {
  it("parses boolean true and false", () => {
    // Act
    const t = zFormBoolean.parse(true);
    const f = zFormBoolean.parse(false);

    // Assert
    expect(t).toBe(true);
    expect(f).toBe(false);
  });

  it('parses string "true" and "false" (form checkbox + hidden)', () => {
    // Act
    const t = zFormBoolean.parse("true");
    const f = zFormBoolean.parse("false");

    // Assert
    expect(t).toBe(true);
    expect(f).toBe(false);
  });

  it("documents why z.coerce.boolean is unsafe for form strings", () => {
    // Act
    const coerced = z.coerce.boolean().parse("false");

    // Assert — known Zod pitfall; zFormBoolean must not behave this way
    expect(coerced).toBe(true);
    expect(zFormBoolean.parse("false")).toBe(false);
  });

  it("rejects other strings", () => {
    // Act
    const result = zFormBoolean.safeParse("maybe");

    // Assert
    expect(result.success).toBe(false);
  });
});
