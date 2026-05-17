import { afterEach, describe, expect, it } from "vitest";

import {
  getActiveProfile,
  listProfileSummary,
  loadProfilesFromEnv,
  normalizeProfileName,
  resetActiveProfileOverride,
  resolveActiveProfileName,
  setActiveProfileOverride,
} from "./profiles.js";

describe("loadProfilesFromEnv", () => {
  afterEach(() => {
    resetActiveProfileOverride();
  });

  it("loads complete profile pairs", () => {
    // Setup
    const env = {
      HERMES_MCP_PROFILE_PROD_BASE_URL: "https://hermes.example.com/",
      HERMES_MCP_PROFILE_PROD_API_KEY: "secret-prod",
      HERMES_MCP_PROFILE_STAGING_BASE_URL: "https://staging.example.com",
      HERMES_MCP_PROFILE_STAGING_API_KEY: "secret-staging",
    };

    // Act
    const profiles = loadProfilesFromEnv(env);

    // Assert
    expect(profiles.size).toBe(2);
    expect(profiles.get("PROD")).toEqual({
      name: "PROD",
      baseUrl: "https://hermes.example.com",
      apiKey: "secret-prod",
    });
  });

  it("skips profiles missing base URL or API key", () => {
    // Setup
    const env = {
      HERMES_MCP_PROFILE_PARTIAL_BASE_URL: "https://partial.example.com",
    };

    // Act
    const profiles = loadProfilesFromEnv(env);

    // Assert
    expect(profiles.size).toBe(0);
  });
});

describe("resolveActiveProfileName", () => {
  afterEach(() => {
    resetActiveProfileOverride();
  });

  it("uses override when set", () => {
    // Setup
    const profiles = loadProfilesFromEnv({
      HERMES_MCP_PROFILE_PROD_BASE_URL: "https://prod.example.com",
      HERMES_MCP_PROFILE_PROD_API_KEY: "key",
    });
    setActiveProfileOverride("prod");

    // Act
    const name = resolveActiveProfileName(profiles);

    // Assert
    expect(name).toBe("PROD");
  });

  it("uses HERMES_MCP_ACTIVE_PROFILE when set", () => {
    // Setup
    const profiles = loadProfilesFromEnv({
      HERMES_MCP_PROFILE_PROD_BASE_URL: "https://prod.example.com",
      HERMES_MCP_PROFILE_PROD_API_KEY: "key",
    });

    // Act
    const name = resolveActiveProfileName(profiles, {
      HERMES_MCP_ACTIVE_PROFILE: "prod",
    });

    // Assert
    expect(name).toBe("PROD");
  });

  it("auto-selects when only one profile exists", () => {
    // Setup
    const profiles = loadProfilesFromEnv({
      HERMES_MCP_PROFILE_ONLY_BASE_URL: "https://only.example.com",
      HERMES_MCP_PROFILE_ONLY_API_KEY: "key",
    });

    // Act
    const name = resolveActiveProfileName(profiles);

    // Assert
    expect(name).toBe("ONLY");
  });

  it("returns undefined when multiple profiles and no active selection", () => {
    // Setup
    const profiles = loadProfilesFromEnv({
      HERMES_MCP_PROFILE_A_BASE_URL: "https://a.example.com",
      HERMES_MCP_PROFILE_A_API_KEY: "a",
      HERMES_MCP_PROFILE_B_BASE_URL: "https://b.example.com",
      HERMES_MCP_PROFILE_B_API_KEY: "b",
    });

    // Act
    const name = resolveActiveProfileName(profiles);

    // Assert
    expect(name).toBeUndefined();
  });
});

describe("getActiveProfile", () => {
  afterEach(() => {
    resetActiveProfileOverride();
  });

  it("returns configuration error when no profiles exist", () => {
    // Act
    const result = getActiveProfile({ env: {} });

    // Assert
    expect(result).toEqual({
      error: expect.stringContaining("No Hermes MCP profiles"),
    });
  });

  it("returns active profile when configured", () => {
    // Act
    const result = getActiveProfile({
      env: {
        HERMES_MCP_PROFILE_PROD_BASE_URL: "https://prod.example.com",
        HERMES_MCP_PROFILE_PROD_API_KEY: "key",
        HERMES_MCP_ACTIVE_PROFILE: "prod",
      },
    });

    // Assert
    expect(result).toEqual({
      profile: {
        name: "PROD",
        baseUrl: "https://prod.example.com",
        apiKey: "key",
      },
    });
  });
});

describe("listProfileSummary", () => {
  it("lists names without secrets", () => {
    // Act
    const summary = listProfileSummary({
      env: {
        HERMES_MCP_PROFILE_PROD_BASE_URL: "https://prod.example.com",
        HERMES_MCP_PROFILE_PROD_API_KEY: "key",
      },
    });

    // Assert
    expect(summary.profiles).toEqual(["PROD"]);
    expect(summary.active).toBe("PROD");
    expect(JSON.stringify(summary)).not.toContain("key");
  });
});

describe("normalizeProfileName", () => {
  it("uppercases and trims", () => {
    expect(normalizeProfileName("  prod ")).toBe("PROD");
  });
});
