/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCreateVariableHandler } from "./route.post.config";

const baseData = {
  body: {
    key: "MY_VAR",
    value: "my-value",
    note: "optional note",
    isSecret: false,
  },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
} as never;

describe("createCreateVariableHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const handler = createCreateVariableHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await handler(baseData);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when variable key already exists", async () => {
    const db = {
      variable: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "existing", key: "MY_VAR" }),
        create: vi.fn(),
      },
    };
    const handler = createCreateVariableHandler({
      getSession: async () => ({ name: "Admin", email: "admin@example.com" }),
      db: db as never,
    });
    const result = await handler(baseData);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "already exists",
    );
    expect(db.variable.create).not.toHaveBeenCalled();
  });

  it("creates variable and returns id", async () => {
    const createMock = vi.fn().mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
    });
    const db = {
      variable: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: createMock,
      },
    };
    const handler = createCreateVariableHandler({
      getSession: async () => ({ name: "Admin", email: "admin@example.com" }),
      db: db as never,
    });
    const result = await handler(baseData);

    expect(result.status).toBe(true);
    expect((result as { data?: { id: string } }).data?.id).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(createMock).toHaveBeenCalledWith({
      data: {
        key: "MY_VAR",
        value: "my-value",
        note: "optional note",
        isSecret: false,
      },
    });
  });

  it("creates variable with null note when note is empty string", async () => {
    const createMock = vi.fn().mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000002",
    });
    const db = {
      variable: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: createMock,
      },
    };
    const handler = createCreateVariableHandler({
      getSession: async () => ({ name: "Admin", email: "admin@example.com" }),
      db: db as never,
    });
    const result = await handler({
      ...baseData,
      body: { key: "OTHER_VAR", value: "v", note: "", isSecret: false },
    } as never);

    expect(result.status).toBe(true);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        key: "OTHER_VAR",
        value: "v",
        note: null,
        isSecret: false,
      },
    });
  });
});
