/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPipelineSummariesWithValidation,
  type PipelineSummariesDb,
} from "./pipeline-summaries";
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

const asSummariesDb = (db: ReturnType<typeof createDb>): PipelineSummariesDb =>
  db as unknown as PipelineSummariesDb;

describe("getPipelineSummariesWithValidation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getPipelinesValidationMapMock.mockReset();
  });

  it("loads summary fields and validation steps in one query and strips steps from the result", async () => {
    // Setup
    const db = createDb();
    const createdBy = { id: "u1", name: "Admin", email: "admin@example.com" };
    const pipelines = [
      {
        id: "p1",
        name: "Daily",
        description: "Runs every day",
        isActive: true,
        createdById: "u1",
        createdBy,
        domainIntegrationId: "di-1",
        steps: [
          {
            agentId: "agent-a",
            agentVersion: "1.0.0",
            agentConfigId: null,
            input: { query: "news" },
            config: {},
          },
        ],
      },
    ];
    const validationById = { p1: { valid: true, warnings: [] } };
    db.pipeline.findMany.mockResolvedValue(pipelines);
    getPipelinesValidationMapMock.mockResolvedValue(validationById);

    // Act
    const result = await getPipelineSummariesWithValidation(asSummariesDb(db));

    // Assert
    expect(db.pipeline.findMany).toHaveBeenCalledTimes(1);
    expect(db.pipeline.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdById: true,
        createdBy: { select: { id: true, name: true, email: true } },
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
        {
          id: "p1",
          name: "Daily",
          description: "Runs every day",
          isActive: true,
          createdById: "u1",
          createdBy,
        },
      ],
      pipelineValidationById: validationById,
    });
  });
});
