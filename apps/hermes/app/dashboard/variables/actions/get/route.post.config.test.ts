/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGetVariableHandler } from "./route.post.config";

const baseData = {
  body: { id: "00000000-0000-4000-8000-000000000001" },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
} as never;

describe("createGetVariableHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const handler = createGetVariableHandler({
      getSession: async () => null,
      getById: vi.fn(),
    });
    const result = await handler(baseData);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when variable not found", async () => {
    const getById = vi.fn().mockResolvedValue(null);
    const handler = createGetVariableHandler({
      getSession: async () => ({ name: "Admin", email: "a@b.com" }),
      getById,
    });
    const result = await handler(baseData);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Variable not found");
  });

  it("returns variable with value masked when isSecret", async () => {
    const getById = vi.fn().mockResolvedValue({
      id: baseData.body.id,
      key: "SECRET_KEY",
      value: "••••••••",
      note: null,
      isSecret: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const handler = createGetVariableHandler({
      getSession: async () => ({ name: "Admin", email: "a@b.com" }),
      getById,
    });
    const result = await handler(baseData);
    expect(result.status).toBe(true);
    const data = (result as { data?: { value: string; isSecret: boolean } })
      .data;
    expect(data?.value).toBe("••••••••");
    expect(data?.isSecret).toBe(true);
  });
});
