import { describe, expect, it } from "vitest";
import {
  detectIsIosUserAgent,
  detectIsMacOsUserAgent,
  detectMailPlatform,
  getMailAppChoiceOptions,
} from "./detect-mail-platform";

describe("detectIsIosUserAgent", () => {
  it("detects iPhone user agents", () => {
    expect(
      detectIsIosUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe(true);
  });

  it("returns false for macOS desktop user agents", () => {
    expect(
      detectIsIosUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"),
    ).toBe(false);
  });
});

describe("detectIsMacOsUserAgent", () => {
  it("detects macOS desktop user agents", () => {
    expect(
      detectIsMacOsUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      ),
    ).toBe(true);
  });

  it("returns false for iPhone user agents that include Mac OS X", () => {
    expect(
      detectIsMacOsUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe(false);
  });

  it("returns false for Windows user agents", () => {
    expect(detectIsMacOsUserAgent("Mozilla/5.0 (Windows NT 10.0)")).toBe(false);
  });
});

describe("detectMailPlatform", () => {
  it("detects macOS user agents", () => {
    expect(
      detectMailPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"),
    ).toBe("macos");
  });

  it("detects Windows user agents", () => {
    expect(detectMailPlatform("Mozilla/5.0 (Windows NT 10.0)")).toBe("windows");
  });

  it("falls back to other for unknown platforms", () => {
    expect(detectMailPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("other");
  });
});

describe("getMailAppChoiceOptions", () => {
  it("returns Outlook, Apple Mail, and Other on macOS", () => {
    const options = getMailAppChoiceOptions("macos");
    expect(options.map((option) => option.id)).toEqual([
      "outlook",
      "native-mail",
      "other",
    ]);
    expect(options[0]?.description).toContain("default mail app");
  });

  it("returns Outlook, Windows Mail, and Other on Windows", () => {
    const options = getMailAppChoiceOptions("windows");
    expect(options[1]?.title).toBe("Windows Mail");
  });
});
