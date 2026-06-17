import { afterEach, describe, expect, it, vi } from "vitest";

import { createActivityReporter } from "./create-activity-reporter";

describe("createActivityReporter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs activity when jobId and token are present", async () => {
    // Setup
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const report = createActivityReporter({
      registryUrl: "https://registry.test",
      jobId: "job-1",
      token: "Bearer tok",
      fetchFn,
    });

    // Act
    report("Fetching", "3 URLs", "processing");

    // Assert
    await vi.waitFor(() => {
      expect(fetchFn).toHaveBeenCalledOnce();
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://registry.test/api/agent-activity",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer tok",
        },
        body: JSON.stringify({
          jobId: "job-1",
          title: "Fetching",
          description: "3 URLs",
          status: "processing",
        }),
      },
    );
  });

  it("no-ops when jobId is missing", () => {
    // Setup
    const fetchFn = vi.fn();
    const report = createActivityReporter({
      registryUrl: "https://registry.test",
      jobId: undefined,
      token: "Bearer tok",
      fetchFn,
    });

    // Act
    report("Step");

    // Assert
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("no-ops when token is missing", () => {
    // Setup
    const fetchFn = vi.fn();
    const report = createActivityReporter({
      registryUrl: "https://registry.test",
      jobId: "job-1",
      token: undefined,
      fetchFn,
    });

    // Act
    report("Step");

    // Assert
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("swallows fetch errors", async () => {
    // Setup
    const fetchFn = vi.fn().mockRejectedValue(new Error("network"));
    const report = createActivityReporter({
      registryUrl: "https://registry.test",
      jobId: "job-1",
      token: "Bearer tok",
      fetchFn,
    });

    // Act
    report("Step");

    // Assert
    await vi.waitFor(() => {
      expect(fetchFn).toHaveBeenCalledOnce();
    });
  });
});
