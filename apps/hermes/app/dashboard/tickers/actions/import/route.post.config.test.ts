/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createImportTickersHandler } from "./route.post.config";

describe("createImportTickersHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const handler = createImportTickersHandler({
      getSession: async () => null,
      importIdx: async () => ({ added: 0, updated: 0 }),
      db: {} as never,
    });
    const result = await handler({
      body: {
        payloadJson: JSON.stringify({
          data: [{ KodeEmiten: "A", NamaEmiten: "A Inc" }],
        }),
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when payloadJson is invalid JSON", async () => {
    const importIdx = vi.fn();
    const handler = createImportTickersHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      importIdx,
      db: {} as never,
    });
    const result = await handler({
      body: { payloadJson: "not valid json {" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Invalid JSON");
    expect(importIdx).not.toHaveBeenCalled();
  });

  it("returns error when payload lacks valid data array", async () => {
    const importIdx = vi.fn();
    const handler = createImportTickersHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      importIdx,
      db: {} as never,
    });
    const result = await handler({
      body: { payloadJson: JSON.stringify({ data: "not array" }) },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "Invalid IDX payload",
    );
    expect(importIdx).not.toHaveBeenCalled();
  });

  it("calls importIdx with parsed payload and returns added/updated", async () => {
    const importIdx = vi.fn().mockResolvedValue({ added: 2, updated: 1 });
    const handler = createImportTickersHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      importIdx,
      db: {} as never,
    });
    const payload = {
      data: [
        { KodeEmiten: "A", NamaEmiten: "A Inc" },
        { KodeEmiten: "B", NamaEmiten: "B Inc" },
        { KodeEmiten: "C", NamaEmiten: "C Inc" },
      ],
    };
    const result = await handler({
      body: { payloadJson: JSON.stringify(payload) },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(importIdx).toHaveBeenCalledTimes(1);
    expect(importIdx).toHaveBeenCalledWith(payload, expect.anything());
    expect(result).toMatchObject({
      status: true,
      data: { added: 2, updated: 1 },
    });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const importIdx = vi.fn().mockResolvedValue({ added: 0, updated: 0 });
    const customHandler = createImportTickersHandler({
      getSession: async () => ({ name: "Admin", email: "admin@test.com" }),
      importIdx,
    });
    const result = await customHandler({
      body: {
        payloadJson: JSON.stringify({ data: [] }),
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
    expect(importIdx).toHaveBeenCalled();
  });
});
