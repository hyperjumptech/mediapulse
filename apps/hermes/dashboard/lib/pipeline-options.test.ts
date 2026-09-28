/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPipelineOptions,
  getPipelineOptionsWithValidation,
  type PipelineOptionsDb,
} from "./pipeline-options";
import { getPipelinesValidationMap } from "./validate-pipeline";

vi.mock("./validate-pipeline", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, getPipelinesValidationMap: vi.fn() };
});

const getPipelinesValidationMapMock = vi.mocked(getPipelinesValidationMap);

const createDb = () => ({
  pipeline: { findMany: vi.fn() },
  agentRegistry: { findMany: vi.fn() },
  agentConfig: { findMany: vi.fn() },
});

const asOptionsDb = (db: ReturnType<typeof createDb>): PipelineOptionsDb =>
  db as unknown as PipelineOptionsDb;

describe("getPipelineOptions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects only id, name, and isActive ordered by most recently updated", async () => {
    // Setup
    const db = createDb();
    const pipelines = [{ id: "p1", name: "Daily", isActive: true }];
    db.pipeline.findMany.mockResolvedValue(pipelines);

    // Act
    const result = await getPipelineOptions(asOptionsDb(db));

    // Assert
    expect(db.pipeline.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    expect(result).toEqual(pipelines);
    expect(getPipelinesValidationMapMock).not.toHaveBeenCalled();
  });
});

describe("getPipelineOptionsWithValidation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getPipelinesValidationMapMock.mockReset();
  });

  it("loads steps for validation in one query and returns options without steps", async () => {
    // Setup
    const db = createDb();
    const step = {
      agentId: "agent-a",
      agentVersion: "1.0.0",
      agentConfigId: null,
      input: {},
      config: {},
    };
    const pipelines = [
      {
        id: "p1",
        name: "Daily",
        isActive: true,
        domainIntegrationId: "di-1",
        steps: [step],
      },
      {
        id: "p2",
        name: "Weekly",
        isActive: false,
        domainIntegrationId: "di-1",
        steps: [],
      },
    ];
    const validationById = {
      p1: { valid: false, warnings: ["Step 1: agent not found in registry"] },
      p2: { valid: true, warnings: [] },
    };
    db.pipeline.findMany.mockResolvedValue(pipelines);
    getPipelinesValidationMapMock.mockResolvedValue(validationById);

    // Act
    const result = await getPipelineOptionsWithValidation(asOptionsDb(db));

    // Assert
    expect(db.pipeline.findMany).toHaveBeenCalledTimes(1);
    expect(db.pipeline.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
        isActive: true,
        domainIntegrationId: true,
        steps: {
          orderBy: { order: "asc" },
          select: {
            agentId: true,
            agentVersion: true,
            agentConfigId: true,
            input: true,
            config: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    expect(getPipelinesValidationMapMock).toHaveBeenCalledWith(pipelines, db);
    expect(result).toEqual({
      pipelines: [
        { id: "p1", name: "Daily", isActive: true },
        { id: "p2", name: "Weekly", isActive: false },
      ],
      pipelineValidationById: validationById,
    });
  });
});
