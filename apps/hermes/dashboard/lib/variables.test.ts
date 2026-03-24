/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRuntimeVariableMap,
  fromStoredSecretVariableValue,
  getVariableById,
  getVariablesPage,
  maskValueIfSecret,
  SECRET_MASK,
  toStoredVariableValue,
} from "./variables";

const createMockDb = (overrides?: {
  findMany?: ReturnType<typeof vi.fn>;
  count?: ReturnType<typeof vi.fn>;
  findUnique?: ReturnType<typeof vi.fn>;
}) => {
  const findMany = overrides?.findMany ?? vi.fn();
  const count = overrides?.count ?? vi.fn();
  const findUnique = overrides?.findUnique ?? vi.fn();
  return {
    variable: {
      findMany,
      count,
      findUnique,
    },
  } as never;
};

describe("maskValueIfSecret", () => {
  it("returns value when isSecret is false", () => {
    expect(maskValueIfSecret("plain", false)).toBe("plain");
  });

  it("returns SECRET_MASK when isSecret is true", () => {
    expect(maskValueIfSecret("secret", true)).toBe(SECRET_MASK);
  });
});

describe("secret variable transforms", () => {
  it("encrypts stored value when isSecret is true", () => {
    // Act
    const stored = toStoredVariableValue("secret-value", true, "x".repeat(32));

    // Assert
    expect(stored).not.toBe("secret-value");
  });

  it("keeps plaintext when isSecret is false", () => {
    // Act
    const stored = toStoredVariableValue("plain-value", false, "x".repeat(32));

    // Assert
    expect(stored).toBe("plain-value");
  });

  it("returns plaintext as-is for legacy secret rows", () => {
    // Act
    const value = fromStoredSecretVariableValue("legacy-plain", "x".repeat(32));

    // Assert
    expect(value).toBe("legacy-plain");
  });

  it("builds runtime map with decrypted secret values", () => {
    // Setup
    const masterKey = "x".repeat(32);
    const encrypted = toStoredVariableValue("resolved-secret", true, masterKey);

    // Act
    const map = buildRuntimeVariableMap(
      [
        { key: "PUBLIC", value: "visible", isSecret: false },
        { key: "SECRET", value: encrypted, isSecret: true },
      ],
      masterKey,
    );

    // Assert
    expect(map.get("PUBLIC")).toBe("visible");
    expect(map.get("SECRET")).toBe("resolved-secret");
  });

  it("uses fallback key when decrypting rotated secret values", () => {
    // Setup
    const oldMasterKey = "x".repeat(32);
    const newMasterKey = "y".repeat(32);
    const encrypted = toStoredVariableValue(
      "resolved-secret",
      true,
      oldMasterKey,
    );

    // Act
    const map = buildRuntimeVariableMap(
      [{ key: "SECRET", value: encrypted, isSecret: true }],
      newMasterKey,
      oldMasterKey,
    );

    // Assert
    expect(map.get("SECRET")).toBe("resolved-secret");
  });
});

describe("getVariablesPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns paginated variables with value masked for secrets", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "v1",
        key: "PUBLIC",
        value: "visible",
        note: null,
        isSecret: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "v2",
        key: "SECRET",
        value: "hidden",
        note: "a note",
        isSecret: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const count = vi.fn().mockResolvedValue(2);
    const db = createMockDb({ findMany, count });

    const result = await getVariablesPage(1, 10, undefined, db);

    expect(result.variables).toHaveLength(2);
    expect(result.variables[0]?.value).toBe("visible");
    expect(result.variables[1]?.value).toBe(SECRET_MASK);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it("applies search where when search term provided", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const db = createMockDb({ findMany, count });

    await getVariablesPage(1, 10, { search: "API" }, db);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: { contains: "API", mode: "insensitive" } },
      }),
    );
  });
});

describe("getVariableById", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns variable with value masked when isSecret", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "v1",
      key: "KEY",
      value: "secret-val",
      note: null,
      isSecret: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const db = createMockDb({ findUnique });

    const result = await getVariableById("v1", db);

    expect(result).not.toBeNull();
    expect(result?.value).toBe(SECRET_MASK);
    expect(result?.key).toBe("KEY");
  });

  it("returns null when not found", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const db = createMockDb({ findUnique });

    const result = await getVariableById("missing", db);

    expect(result).toBeNull();
  });
});
