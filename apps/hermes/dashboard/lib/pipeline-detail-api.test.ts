/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  getPipelineDetailForApi,
  type PipelineDetailApiDependencies,
} from "@/lib/pipeline-detail-api";

const pipelineId = "00000000-0000-4000-8000-000000000001";

const pipeline = {
  id: pipelineId,
  name: "Daily",
  steps: [],
} as unknown as NonNullable<
  Awaited<ReturnType<PipelineDetailApiDependencies["getPipeline"]>>
>;

describe("getPipelineDetailForApi", () => {
  it("adds validation and run parameter keys to the pipeline", async () => {
    const dependencies: PipelineDetailApiDependencies = {
      getPipeline: vi.fn().mockResolvedValue(pipeline),
      validate: vi
        .fn()
        .mockResolvedValue({ valid: false, warnings: ["Step 1: bad input"] }),
      getRunParamKeys: vi.fn().mockResolvedValue(["itemId"]),
    };

    const detail = await getPipelineDetailForApi(pipelineId, dependencies);

    expect(detail).toEqual({
      ...pipeline,
      validation: { valid: false, warnings: ["Step 1: bad input"] },
      runParamKeys: ["itemId"],
    });
    expect(dependencies.getRunParamKeys).toHaveBeenCalledWith(pipelineId);
  });

  it("returns null without validating when the pipeline is missing", async () => {
    const dependencies: PipelineDetailApiDependencies = {
      getPipeline: vi.fn().mockResolvedValue(null),
      validate: vi.fn(),
      getRunParamKeys: vi.fn(),
    };

    const detail = await getPipelineDetailForApi(pipelineId, dependencies);

    expect(detail).toBeNull();
    expect(dependencies.validate).not.toHaveBeenCalled();
  });
});
