/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPipelineWithSteps } from "@/lib/pipelines";
import { getPipelineStatus, validatePipeline } from "@/lib/validate-pipeline";
import { disableSchedulesForPipelineIfNotEnabled } from "./disable-schedules-for-pipeline";

vi.mock("@/lib/pipelines", () => ({
  getPipelineWithSteps: vi.fn(),
}));

vi.mock("@/lib/validate-pipeline", () => ({
  validatePipeline: vi.fn(),
  getPipelineStatus: vi.fn(),
}));

const getPipelineWithStepsMock = vi.mocked(getPipelineWithSteps);
const validatePipelineMock = vi.mocked(validatePipeline);
const getPipelineStatusMock = vi.mocked(getPipelineStatus);

describe("disableSchedulesForPipelineIfNotEnabled", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when pipeline is null", async () => {
    // Setup
    getPipelineWithStepsMock.mockResolvedValue(null);
    const db = { schedule: { updateMany: vi.fn() } };

    // Act
    await disableSchedulesForPipelineIfNotEnabled(db as never, "p1");

    // Assert
    expect(db.schedule.updateMany).not.toHaveBeenCalled();
    expect(validatePipelineMock).not.toHaveBeenCalled();
  });

  it("does not disable schedules when pipeline is enabled", async () => {
    // Setup
    const pipeline = { id: "p1", isActive: true, steps: [] };
    getPipelineWithStepsMock.mockResolvedValue(pipeline as never);
    validatePipelineMock.mockResolvedValue({ valid: true, warnings: [] });
    getPipelineStatusMock.mockReturnValue("enabled");
    const db = { schedule: { updateMany: vi.fn() } };

    // Act
    await disableSchedulesForPipelineIfNotEnabled(db as never, "p1");

    // Assert
    expect(db.schedule.updateMany).not.toHaveBeenCalled();
  });

  it("disables schedules when pipeline is disabled (isActive false)", async () => {
    // Setup
    const pipeline = { id: "p1", isActive: false, steps: [] };
    getPipelineWithStepsMock.mockResolvedValue(pipeline as never);
    validatePipelineMock.mockResolvedValue({ valid: true, warnings: [] });
    getPipelineStatusMock.mockReturnValue("disabled");
    const updateManyMock = vi.fn().mockResolvedValue({ count: 2 });
    const db = { schedule: { updateMany: updateManyMock } };

    // Act
    await disableSchedulesForPipelineIfNotEnabled(db as never, "p1");

    // Assert
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { pipelineId: "p1" },
      data: { enabled: false },
    });
  });

  it("disables schedules when pipeline is incomplete (validation invalid)", async () => {
    // Setup
    const pipeline = { id: "p1", isActive: true, steps: [{}] };
    getPipelineWithStepsMock.mockResolvedValue(pipeline as never);
    validatePipelineMock.mockResolvedValue({
      valid: false,
      warnings: ["Step 1: missing input"],
    });
    getPipelineStatusMock.mockReturnValue("incomplete");
    const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });
    const db = { schedule: { updateMany: updateManyMock } };

    // Act
    await disableSchedulesForPipelineIfNotEnabled(db as never, "p1");

    // Assert
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { pipelineId: "p1" },
      data: { enabled: false },
    });
  });
});
