/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import type { HermesHttpClient, HermesHttpResponse } from "./http-client.js";
import {
  assertMutationAllowed,
  buildProfileCacheKey,
  createWhoamiCache,
  isReadOnlyKeyHttpResponse,
  parseWhoamiReadOnly,
  WHOAMI_CACHE_TTL_MILLISECONDS,
  withWhoamiCacheInvalidation,
} from "./mutation-access.js";

const whoamiResponse = (status: number, body: unknown): HermesHttpResponse => ({
  status,
  body,
  text: JSON.stringify(body),
});

const createClient = (...responses: HermesHttpResponse[]) => {
  const request = vi.fn<HermesHttpClient["request"]>();
  for (const response of responses) {
    request.mockResolvedValueOnce(response);
  }
  const httpClient: HermesHttpClient = { request };

  return { httpClient, request };
};

const createClock = (startAt = 1_000) => {
  let current = startAt;

  return {
    now: () => current,
    advance: (milliseconds: number) => {
      current += milliseconds;
    },
  };
};

describe("parseWhoamiReadOnly", () => {
  it("returns readOnly when present", () => {
    expect(parseWhoamiReadOnly({ readOnly: true })).toBe(true);
    expect(parseWhoamiReadOnly({ readOnly: false })).toBe(false);
  });

  it("returns null for invalid bodies", () => {
    expect(parseWhoamiReadOnly(null)).toBeNull();
    expect(parseWhoamiReadOnly({})).toBeNull();
  });
});

describe("isReadOnlyKeyHttpResponse", () => {
  it("detects read_only_key 403", () => {
    expect(
      isReadOnlyKeyHttpResponse(403, { code: "read_only_key", message: "no" }),
    ).toBe(true);
  });

  it("returns false for other responses", () => {
    expect(isReadOnlyKeyHttpResponse(401, { error: "Unauthorized" })).toBe(
      false,
    );
  });
});

describe("buildProfileCacheKey", () => {
  it("differs by profile name and base URL, never includes the API key", () => {
    const productionKey = buildProfileCacheKey({
      name: "PROD",
      baseUrl: "https://hermes.example.com",
      apiKey: "secret-one",
    });
    const stagingKey = buildProfileCacheKey({
      name: "STAGING",
      baseUrl: "https://staging.example.com",
      apiKey: "secret-two",
    });

    expect(productionKey).not.toBe(stagingKey);
    expect(productionKey).not.toContain("secret-one");
  });
});

describe("createWhoamiCache", () => {
  it("returns a snapshot for the same profile until the TTL passes", () => {
    const clock = createClock();
    const cache = createWhoamiCache({ now: clock.now });
    cache.write("PROD", { readOnly: false });

    const beforeExpiry = cache.read("PROD");
    clock.advance(WHOAMI_CACHE_TTL_MILLISECONDS);
    const afterExpiry = cache.read("PROD");

    expect(WHOAMI_CACHE_TTL_MILLISECONDS).toBe(300_000);
    expect(beforeExpiry).toEqual({ readOnly: false });
    expect(afterExpiry).toBeUndefined();
  });

  it("misses and drops the entry when the profile changes", () => {
    const cache = createWhoamiCache();
    cache.write("PROD", { readOnly: false });

    const otherProfile = cache.read("STAGING");
    const originalProfile = cache.read("PROD");

    expect(otherProfile).toBeUndefined();
    expect(originalProfile).toBeUndefined();
  });

  it("forgets everything on clear", () => {
    const cache = createWhoamiCache();
    cache.write("PROD", { readOnly: true });

    cache.clear();

    expect(cache.read("PROD")).toBeUndefined();
  });
});

describe("withWhoamiCacheInvalidation", () => {
  it.each([401, 403])(
    "clears the cache on HTTP %i from any request",
    async (status) => {
      const cache = createWhoamiCache();
      cache.write("PROD", { readOnly: false });
      const { httpClient } = createClient(whoamiResponse(status, {}));
      const guardedClient = withWhoamiCacheInvalidation(httpClient, cache);

      await guardedClient.request({ method: "GET", path: "/api/agents" });

      expect(cache.read("PROD")).toBeUndefined();
    },
  );

  it("keeps the cache on success", async () => {
    const cache = createWhoamiCache();
    cache.write("PROD", { readOnly: false });
    const { httpClient } = createClient(whoamiResponse(200, {}));
    const guardedClient = withWhoamiCacheInvalidation(httpClient, cache);

    await guardedClient.request({ method: "GET", path: "/api/agents" });

    expect(cache.read("PROD")).toEqual({ readOnly: false });
  });
});

describe("assertMutationAllowed", () => {
  it("allows when whoami reports a full-access key", async () => {
    const { httpClient } = createClient(
      whoamiResponse(200, { readOnly: false, label: "full" }),
    );

    const result = await assertMutationAllowed({ httpClient });

    expect(result).toEqual({ allowed: true });
  });

  it("blocks read-only keys before mutations", async () => {
    const { httpClient } = createClient(
      whoamiResponse(200, { readOnly: true }),
    );

    const result = await assertMutationAllowed({ httpClient });

    expect(result).toMatchObject({ isError: true });
    const text =
      "content" in result && result.content[0]?.type === "text"
        ? result.content[0].text
        : "";
    expect(text).toContain("Read-only");
  });

  it("calls whoami once per profile within the TTL", async () => {
    const clock = createClock();
    const whoamiCache = createWhoamiCache({ now: clock.now });
    const { httpClient, request } = createClient(
      whoamiResponse(200, { readOnly: false }),
      whoamiResponse(200, { readOnly: false }),
    );

    const first = await assertMutationAllowed({
      httpClient,
      whoamiCache,
      profileKey: "PROD",
    });
    const second = await assertMutationAllowed({
      httpClient,
      whoamiCache,
      profileKey: "PROD",
    });
    clock.advance(WHOAMI_CACHE_TTL_MILLISECONDS + 1);
    await assertMutationAllowed({
      httpClient,
      whoamiCache,
      profileKey: "PROD",
    });

    expect(first).toEqual({ allowed: true });
    expect(second).toEqual({ allowed: true });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("serves a cached read-only verdict without calling Hermes", async () => {
    const whoamiCache = createWhoamiCache();
    whoamiCache.write("PROD", { readOnly: true });
    const { httpClient, request } = createClient();

    const result = await assertMutationAllowed({
      httpClient,
      whoamiCache,
      profileKey: "PROD",
    });

    expect(result).toMatchObject({ isError: true });
    expect(request).not.toHaveBeenCalled();
  });

  it("does not cache when no profile key is known", async () => {
    const whoamiCache = createWhoamiCache();
    const { httpClient, request } = createClient(
      whoamiResponse(200, { readOnly: false }),
      whoamiResponse(200, { readOnly: false }),
    );

    await assertMutationAllowed({ httpClient, whoamiCache });
    await assertMutationAllowed({ httpClient, whoamiCache });

    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403])(
    "clears the cache and reports the rejection on whoami HTTP %i",
    async (status) => {
      const whoamiCache = createWhoamiCache();
      whoamiCache.write("OTHER", { readOnly: false });
      const { httpClient } = createClient(
        whoamiResponse(status, { error: "Unauthorized" }),
      );

      const result = await assertMutationAllowed({
        httpClient,
        whoamiCache,
        profileKey: "PROD",
      });

      expect(result).toMatchObject({ isError: true });
      expect(whoamiCache.read("OTHER")).toBeUndefined();
    },
  );

  it("does not cache failed whoami calls", async () => {
    const whoamiCache = createWhoamiCache();
    const { httpClient } = createClient(whoamiResponse(500, "boom"));

    const result = await assertMutationAllowed({
      httpClient,
      whoamiCache,
      profileKey: "PROD",
    });

    expect(result).toMatchObject({ isError: true });
    expect(whoamiCache.read("PROD")).toBeUndefined();
  });
});
