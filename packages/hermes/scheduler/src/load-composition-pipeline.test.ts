import { describe, expect, it, vi } from "vitest";

import { createCompositionPipelineLoader } from "./load-composition-pipeline";

describe("createCompositionPipelineLoader", () => {
  it("loads each pipeline once per loader", async () => {
    const pipeline = {
      id: "p1",
      name: "P1",
      timeout: null,
      domainIntegrationId: "di-1",
      steps: [],
    };
    const findUnique = vi.fn().mockResolvedValue(pipeline);
    const loadPipeline = createCompositionPipelineLoader({
      pipeline: { findUnique } as never,
    });

    const first = await loadPipeline("p1");
    const second = await loadPipeline("p1");

    expect(first).toBe(pipeline);
    expect(second).toBe(pipeline);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1" } }),
    );
  });

  it("returns null for a pipeline that does not exist", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const loadPipeline = createCompositionPipelineLoader({
      pipeline: { findUnique } as never,
    });

    expect(await loadPipeline("missing")).toBeNull();
  });
});
