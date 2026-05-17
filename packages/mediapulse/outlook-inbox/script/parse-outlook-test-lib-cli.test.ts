/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { parseOutlookTestLibCli } from "./parse-outlook-test-lib-cli.js";

describe("parseOutlookTestLibCli", () => {
  it("returns credentials when all flags are set", () => {
    // Act
    const result = parseOutlookTestLibCli([
      "--client-id=cid",
      "--client-secret=sec",
      "--tenant-id=tid",
      "--user-id=shared@example.com",
    ]);

    // Assert
    expect(result).toEqual({
      clientId: "cid",
      clientSecret: "sec",
      tenantId: "tid",
      userId: "shared@example.com",
    });
  });

  it("defaults userId to me when user-id is omitted", () => {
    // Act
    const result = parseOutlookTestLibCli([
      "--client-id=cid",
      "--client-secret=sec",
      "--tenant-id=tid",
    ]);

    // Assert
    expect(result.userId).toBe("me");
  });

  it("throws when client-id is missing", () => {
    // Act
    const act = () =>
      parseOutlookTestLibCli(["--client-secret=sec", "--tenant-id=tid"]);

    // Assert
    expect(act).toThrow(/client-id|Required/i);
  });

  it("throws on unknown flags in strict mode", () => {
    // Act
    const act = () =>
      parseOutlookTestLibCli([
        "--client-id=cid",
        "--client-secret=sec",
        "--tenant-id=tid",
        "--extra=bad",
      ]);

    // Assert
    expect(act).toThrow(/unknown|not supported|Option/i);
  });
});
