import { describe, expect, it, vi } from "vitest";

import { resolvePublisherNames } from "./resolve-publisher-names.js";

const model = { apiKey: "key", model: "test-model" };

const makeGenerate = (publishers: { domain: string; displayName: string }[]) =>
  vi.fn().mockResolvedValue({ object: { publishers } });

describe("resolvePublisherNames", () => {
  it("stores a name that only adds spacing and casing to the domain", async () => {
    const listUnresolved = vi.fn().mockResolvedValue({
      publishers: [
        { domain: "thejakartapost.com", displayName: "Thejakartapost" },
      ],
    });
    const recordNames = vi
      .fn()
      .mockResolvedValue({ updatedCount: 1, skippedCount: 0 });
    const result = await resolvePublisherNames({
      listUnresolved,
      recordNames,
      model,
      generateObjectFn: makeGenerate([
        { domain: "thejakartapost.com", displayName: "The Jakarta Post" },
      ]) as never,
    });

    expect(recordNames).toHaveBeenCalledWith({
      publishers: [
        {
          domain: "thejakartapost.com",
          displayName: "The Jakarta Post",
          nameSource: "llm",
        },
      ],
    });
    expect(result.accepted).toBe(1);
    expect(result.recorded).toBe(1);
  });

  it("rejects a name that adds a word the domain does not contain", async () => {
    const listUnresolved = vi.fn().mockResolvedValue({
      publishers: [
        { domain: "bloombergtechnoz.com", displayName: "Bloombergtechnoz" },
      ],
    });
    const recordNames = vi.fn();
    const result = await resolvePublisherNames({
      listUnresolved,
      recordNames,
      model,
      generateObjectFn: makeGenerate([
        {
          domain: "bloombergtechnoz.com",
          displayName: "Bloomberg Technology Indonesia",
        },
      ]) as never,
    });

    expect(recordNames).not.toHaveBeenCalled();
    expect(result).toMatchObject({ accepted: 0, rejected: 1, recorded: 0 });
  });

  it("rejects a suggestion for a domain it never asked about", async () => {
    const listUnresolved = vi.fn().mockResolvedValue({
      publishers: [{ domain: "bisnis.com", displayName: "Bisnis" }],
    });
    const recordNames = vi.fn();
    const result = await resolvePublisherNames({
      listUnresolved,
      recordNames,
      model,
      generateObjectFn: makeGenerate([
        { domain: "evil.com", displayName: "Evil" },
      ]) as never,
    });

    expect(recordNames).not.toHaveBeenCalled();
    expect(result.rejected).toBe(1);
  });

  it("skips the model call when nothing is unresolved", async () => {
    const generateObjectFn = vi.fn();
    const result = await resolvePublisherNames({
      listUnresolved: vi.fn().mockResolvedValue({ publishers: [] }),
      recordNames: vi.fn(),
      model,
      generateObjectFn: generateObjectFn as never,
    });

    expect(generateObjectFn).not.toHaveBeenCalled();
    expect(result.requested).toBe(0);
  });

  it("reports a model failure without throwing", async () => {
    const warn = vi.fn();
    const result = await resolvePublisherNames({
      listUnresolved: vi.fn().mockResolvedValue({
        publishers: [{ domain: "bisnis.com", displayName: "Bisnis" }],
      }),
      recordNames: vi.fn(),
      model,
      logger: { info: vi.fn(), warn },
      generateObjectFn: vi
        .fn()
        .mockRejectedValue(new Error("timeout")) as never,
    });

    expect(result.failed).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it("reports a lookup failure without calling the model", async () => {
    const generateObjectFn = vi.fn();
    const result = await resolvePublisherNames({
      listUnresolved: vi.fn().mockRejectedValue(new Error("503")),
      recordNames: vi.fn(),
      model,
      generateObjectFn: generateObjectFn as never,
    });

    expect(generateObjectFn).not.toHaveBeenCalled();
    expect(result.failed).toBe(true);
  });
});
