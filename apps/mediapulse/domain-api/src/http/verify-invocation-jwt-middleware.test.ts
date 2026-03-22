/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { verifyInvocationJwtFromHeader } from "./verify-invocation-jwt-middleware";

describe("verifyInvocationJwtFromHeader", () => {
  const asFetch = (fn: ReturnType<typeof vi.fn>): typeof fetch =>
    fn as unknown as typeof fetch;

  it("returns true when authApiUrl override is unset (dev bypass)", async () => {
    await expect(
      verifyInvocationJwtFromHeader(undefined, asFetch(vi.fn()), {
        authApiUrl: "",
      }),
    ).resolves.toBe(true);
  });

  it("returns false when auth header is missing but verify URL is set", async () => {
    await expect(
      verifyInvocationJwtFromHeader(undefined, asFetch(vi.fn()), {
        authApiUrl: "http://auth.example",
      }),
    ).resolves.toBe(false);
  });

  it("returns true when verify API returns valid: true", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true }),
    });

    await expect(
      verifyInvocationJwtFromHeader("Bearer abc.def.ghi", asFetch(fetchMock), {
        authApiUrl: "http://auth.example",
      }),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith("http://auth.example/api/verify", {
      method: "POST",
      headers: { Authorization: "Bearer abc.def.ghi" },
    });
  });

  it("returns false when verify API returns non-ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });

    await expect(
      verifyInvocationJwtFromHeader("Bearer t", asFetch(fetchMock), {
        authApiUrl: "http://auth.example",
      }),
    ).resolves.toBe(false);
  });

  it("returns false when verify JSON has valid !== true", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: false }),
    });

    await expect(
      verifyInvocationJwtFromHeader("Bearer t", asFetch(fetchMock), {
        authApiUrl: "http://auth.example",
      }),
    ).resolves.toBe(false);
  });
});
