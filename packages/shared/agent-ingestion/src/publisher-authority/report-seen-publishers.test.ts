import { describe, expect, it, vi } from "vitest";

import { reportSeenPublishers } from "./report-seen-publishers";

describe("reportSeenPublishers", () => {
  it("derives a name from each domain and reports it once", async () => {
    const reportSeen = vi
      .fn()
      .mockResolvedValue({ createdCount: 2, touchedCount: 2 });
    const result = await reportSeenPublishers({
      domains: ["kontan.co.id", "bisnis.com", "kontan.co.id"],
      reportSeen,
    });

    expect(reportSeen).toHaveBeenCalledWith({
      publishers: [
        { domain: "kontan.co.id", displayName: "Kontan" },
        { domain: "bisnis.com", displayName: "Bisnis" },
      ],
    });
    expect(result.createdCount).toBe(2);
  });

  it("drops a domain with no derivable brand token", async () => {
    const reportSeen = vi
      .fn()
      .mockResolvedValue({ createdCount: 1, touchedCount: 1 });

    await reportSeenPublishers({
      domains: ["", "localhost", "bisnis.com"],
      reportSeen,
    });

    expect(reportSeen).toHaveBeenCalledWith({
      publishers: [{ domain: "bisnis.com", displayName: "Bisnis" }],
    });
  });

  it("does not call the transport when nothing is reportable", async () => {
    const reportSeen = vi.fn();
    const result = await reportSeenPublishers({ domains: [], reportSeen });

    expect(reportSeen).not.toHaveBeenCalled();
    expect(result).toEqual({
      requested: 0,
      createdCount: 0,
      touchedCount: 0,
      failed: false,
    });
  });

  it("reports a transport failure without throwing", async () => {
    const reportSeen = vi.fn().mockRejectedValue(new Error("503"));
    const warn = vi.fn();
    const result = await reportSeenPublishers({
      domains: ["bisnis.com"],
      reportSeen,
      logger: { info: vi.fn(), warn },
    });

    expect(result.failed).toBe(true);
    expect(warn).toHaveBeenCalled();
  });
});
