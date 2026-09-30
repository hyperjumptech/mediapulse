import { describe, expect, it } from "vitest";

import {
  HERMES_TOOLSETS,
  loadEnabledToolsets,
  parseEnabledToolsets,
} from "./toolsets.js";

describe("parseEnabledToolsets", () => {
  it("enables every toolset when unset or empty", () => {
    const unset = parseEnabledToolsets(undefined);
    const empty = parseEnabledToolsets(" ");

    expect([...unset]).toEqual([...HERMES_TOOLSETS]);
    expect([...empty]).toEqual([...HERMES_TOOLSETS]);
  });

  it("keeps core and the requested toolsets", () => {
    const enabled = parseEnabledToolsets("Pipelines, agents");

    expect([...enabled].sort()).toEqual(["agents", "core", "pipelines"]);
  });

  it("falls back to every toolset when no name is known", () => {
    const enabled = parseEnabledToolsets("everything");

    expect([...enabled]).toEqual([...HERMES_TOOLSETS]);
  });
});

describe("loadEnabledToolsets", () => {
  it("reads HERMES_MCP_TOOLSETS from the given environment", () => {
    const enabled = loadEnabledToolsets({ HERMES_MCP_TOOLSETS: "domain" });

    expect([...enabled].sort()).toEqual(["core", "domain"]);
  });
});
