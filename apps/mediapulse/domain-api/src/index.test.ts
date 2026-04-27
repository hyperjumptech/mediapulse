/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const registerWithHermes = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

const fetchStub = vi.hoisted(() => vi.fn());

vi.mock("./http/register-with-hermes", () => ({
  registerWithHermes,
}));

vi.mock("./http/create-hono-app", () => ({
  createDomainApiServer: vi.fn(() => ({
    port: 8090,
    fetch: fetchStub,
  })),
}));

describe("src/index", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates the server, awaits Hermes registration, then exports the handle", async () => {
    const { createDomainApiServer } = await import("./http/create-hono-app");

    const mod = await import("./index");

    expect(createDomainApiServer).toHaveBeenCalledTimes(1);
    expect(registerWithHermes).toHaveBeenCalledTimes(1);
    expect(mod.default).toEqual({
      port: 8090,
      fetch: fetchStub,
    });
  });

  it("does not export the server until registration promise settles", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    registerWithHermes.mockImplementationOnce(() => gate);

    const { createDomainApiServer } = await import("./http/create-hono-app");
    const modPromise = import("./index");

    await vi.waitFor(() => {
      expect(createDomainApiServer).toHaveBeenCalledTimes(1);
    });
    await vi.waitFor(() => {
      expect(registerWithHermes).toHaveBeenCalledTimes(1);
    });

    await expect(
      Promise.race([
        modPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("still pending")), 50),
        ),
      ]),
    ).rejects.toThrow("still pending");

    release();
    const mod = await modPromise;
    expect(mod.default.port).toBe(8090);
  });
});
