import { describe, expect, it } from "vitest";
import {
  detectMailPlatform,
  getMailAppChoiceOptions,
} from "./detect-mail-platform";

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
  });

  it("returns Outlook, Windows Mail, and Other on Windows", () => {
    const options = getMailAppChoiceOptions("windows");
    expect(options[1]?.title).toBe("Windows Mail");
  });
});
