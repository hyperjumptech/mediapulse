/** @vitest-environment node */
import type { PrismaClient } from "@workspace/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateDataSourceExpressions } from "@/lib/step-input-expansion";

import { collectEmptyRequiredStringErrors } from "./validate-required-fields";
import {
  getPipelinesValidationMap,
  validatePipeline,
} from "./validate-pipeline";
import { validateWithJsonSchema } from "./validate-json-schema";

vi.mock("@/lib/step-input-expansion", () => ({
  validateDataSourceExpressions: vi.fn(),
}));

vi.mock("./validate-required-fields", () => ({
  collectEmptyRequiredStringErrors: vi.fn(),
}));

vi.mock("./validate-json-schema", () => ({
  validateWithJsonSchema: vi.fn(),
}));

const validateDataSourceExpressionsMock = vi.mocked(
  validateDataSourceExpressions,
);
const collectEmptyRequiredStringErrorsMock = vi.mocked(
  collectEmptyRequiredStringErrors,
);
const validateWithJsonSchemaMock = vi.mocked(validateWithJsonSchema);

type PipelineWithSteps = Parameters<typeof validatePipeline>[0];

const createPipeline = (
  overrides: Partial<PipelineWithSteps> & { steps: PipelineWithSteps["steps"] },
): PipelineWithSteps => ({
  id: "p1",
  name: "Pipeline 1",
  ...overrides,
});

const createStep = (
  overrides: Partial<PipelineWithSteps["steps"][number]> = {},
): PipelineWithSteps["steps"][number] => ({
  id: "s1",
  order: 0,
  agentId: "agent-a",
  agentVersion: "1.0.0",
  agentConfigId: null,
  input: {},
  config: {},
  ...overrides,
});

const createDb = (): {
  agentRegistry: { findFirst: ReturnType<typeof vi.fn> };
  agentConfig: { findFirst: ReturnType<typeof vi.fn> };
} => ({
  agentRegistry: { findFirst: vi.fn() },
  agentConfig: { findFirst: vi.fn() },
});

const asPrisma = (db: ReturnType<typeof createDb>): PrismaClient =>
  db as unknown as PrismaClient;

describe("validatePipeline", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    validateDataSourceExpressionsMock.mockClear();
    collectEmptyRequiredStringErrorsMock.mockClear();
    validateWithJsonSchemaMock.mockClear();
  });

  it("returns valid true and empty warnings when pipeline has no steps", async () => {
    // Setup
    const pipeline = createPipeline({ steps: [] });
    const db = asPrisma(createDb());

    // Act
    const result = await validatePipeline(pipeline, db);

    // Assert
    expect(result).toEqual({ valid: true, warnings: [] });
    expect(db.agentRegistry.findFirst).not.toHaveBeenCalled();
  });

  it("skips step when step is undefined (sparse array)", async () => {
    // Setup — steps array with undefined at index 1
    const pipeline = createPipeline({
      steps: [createStep(), undefined as never, createStep({ id: "s3" })],
    });
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue({
      inputSchema: null,
      configSchema: null,
    });
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });

    // Act
    const result = await validatePipeline(pipeline, asPrisma(db));

    // Assert — findFirst called only for first and third step (2 times)
    expect(db.agentRegistry.findFirst).toHaveBeenCalledTimes(2);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("adds warning and continues when agent not found in registry", async () => {
    // Setup
    const pipeline = createPipeline({
      steps: [createStep({ agentId: "missing", agentVersion: "1.0.0" })],
    });
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue(null);

    // Act
    const result = await validatePipeline(pipeline, asPrisma(db));

    // Assert
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain(
      "Step 1 (missing@1.0.0): agent not found in registry",
    );
  });

  it("normalizes non-object input and config to empty object", async () => {
    // Setup — input string, config array: both become {}
    const pipeline = createPipeline({
      steps: [
        createStep({
          input: "not-an-object" as never,
          config: ["array"] as never,
        }),
      ],
    });
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue({
      inputSchema: null,
      configSchema: null,
    });
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });

    // Act
    await validatePipeline(pipeline, asPrisma(db));

    // Assert
    expect(validateDataSourceExpressionsMock).toHaveBeenCalledWith({});
  });

  it("adds warning when data source expressions are invalid", async () => {
    // Setup
    const pipeline = createPipeline({
      steps: [createStep({ input: { key: "db:invalid" } })],
    });
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue({
      inputSchema: null,
      configSchema: null,
    });
    validateDataSourceExpressionsMock.mockReturnValue({
      valid: false,
      errors: ['Param "key": invalid data source format'],
    });

    // Act
    const result = await validatePipeline(pipeline, asPrisma(db));

    // Assert
    expect(result.valid).toBe(false);
    expect(result.warnings.some((w) => w.includes("input:"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("invalid data source"))).toBe(
      true,
    );
  });

  it("adds input warning when empty required string errors exist", async () => {
    // Setup
    const inputSchema = { type: "object", required: ["name"] };
    const pipeline = createPipeline({
      steps: [createStep({ input: { name: "" } })],
    });
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue({
      inputSchema,
      configSchema: null,
    });
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([
      "/ name is required but empty",
    ]);
    validateWithJsonSchemaMock.mockReturnValue({ valid: true });

    // Act
    const result = await validatePipeline(pipeline, asPrisma(db));

    // Assert
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain(
      "Step 1 (agent-a@1.0.0) input: / name is required but empty",
    );
  });

  it("adds input warning when JSON schema validation fails", async () => {
    // Setup
    const inputSchema = { type: "object", required: ["x"] };
    const pipeline = createPipeline({
      steps: [createStep({ input: {} })],
    });
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue({
      inputSchema,
      configSchema: null,
    });
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([]);
    validateWithJsonSchemaMock.mockReturnValue({
      valid: false,
      errors: ["/ x is required"],
    });

    // Act
    const result = await validatePipeline(pipeline, asPrisma(db));

    // Assert
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain(
      "Step 1 (agent-a@1.0.0) input: / x is required",
    );
  });

  it("skips input validation when agent has no inputSchema", async () => {
    // Setup
    const pipeline = createPipeline({
      steps: [createStep({ input: { anything: true } })],
    });
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue({
      inputSchema: null,
      configSchema: null,
    });
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });

    // Act
    const result = await validatePipeline(pipeline, asPrisma(db));

    // Assert
    expect(collectEmptyRequiredStringErrorsMock).not.toHaveBeenCalled();
    expect(validateWithJsonSchemaMock).not.toHaveBeenCalled();
    expect(result.valid).toBe(true);
  });

  it("adds config warning when saved config not found for agentConfigId", async () => {
    // Setup
    const configSchema = { type: "object", required: ["option"] };
    const pipeline = createPipeline({
      steps: [
        createStep({
          agentConfigId: "config-1",
          config: {},
        }),
      ],
    });
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue({
      inputSchema: null,
      configSchema,
    });
    db.agentConfig.findFirst.mockResolvedValue(null);
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([]);
    validateWithJsonSchemaMock.mockReturnValue({ valid: true });

    // Act
    const result = await validatePipeline(pipeline, asPrisma(db));

    // Assert
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain(
      "Step 1 (agent-a@1.0.0): saved config not found",
    );
  });

  it("uses saved config as effectiveConfig when agentConfigId is set", async () => {
    // Setup
    const configSchema = { type: "object" };
    const savedConfig = { id: "config-1", config: { option: "value" } };
    const pipeline = createPipeline({
      steps: [
        createStep({
          agentConfigId: "config-1",
          config: { ignored: true },
        }),
      ],
    });
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue({
      inputSchema: null,
      configSchema,
    });
    db.agentConfig.findFirst.mockResolvedValue(savedConfig);
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([]);
    validateWithJsonSchemaMock.mockReturnValue({ valid: true });

    // Act
    await validatePipeline(pipeline, asPrisma(db));

    // Assert — validateWithJsonSchema called for config with saved config object
    expect(validateWithJsonSchemaMock).toHaveBeenCalledWith(configSchema, {
      option: "value",
    });
  });

  it("uses empty object when savedConfig.config is not an object", async () => {
    // Setup
    const configSchema = { type: "object" };
    const pipeline = createPipeline({
      steps: [createStep({ agentConfigId: "config-1", config: {} })],
    });
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue({
      inputSchema: null,
      configSchema,
    });
    db.agentConfig.findFirst.mockResolvedValue({
      id: "config-1",
      config: "string-not-object",
    });
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([]);
    validateWithJsonSchemaMock.mockReturnValue({ valid: true });

    // Act
    await validatePipeline(pipeline, asPrisma(db));

    // Assert
    expect(validateWithJsonSchemaMock).toHaveBeenCalledWith(configSchema, {});
  });

  it("adds config warning for empty required string errors", async () => {
    // Setup
    const configSchema = { type: "object", required: ["option"] };
    const pipeline = createPipeline({
      steps: [createStep({ config: { option: "" } })],
    });
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue({
      inputSchema: null,
      configSchema,
    });
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([
      "/ option is required but empty",
    ]);
    validateWithJsonSchemaMock.mockReturnValue({ valid: true });

    // Act
    const result = await validatePipeline(pipeline, asPrisma(db));

    // Assert
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain(
      "Step 1 (agent-a@1.0.0) config: / option is required but empty",
    );
  });

  it("adds config warning when config JSON schema validation fails", async () => {
    // Setup
    const configSchema = { type: "object", required: ["option"] };
    const pipeline = createPipeline({
      steps: [createStep({ config: {} })],
    });
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue({
      inputSchema: null,
      configSchema,
    });
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([]);
    validateWithJsonSchemaMock.mockReturnValue({
      valid: false,
      errors: ["/ option required"],
    });

    // Act
    const result = await validatePipeline(pipeline, asPrisma(db));

    // Assert
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain(
      "Step 1 (agent-a@1.0.0) config: / option required",
    );
  });

  it("returns valid true when all steps pass validation", async () => {
    // Setup
    const pipeline = createPipeline({
      steps: [createStep({ input: { x: "a" }, config: { y: "b" } })],
    });
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue({
      inputSchema: { type: "object" },
      configSchema: { type: "object" },
    });
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([]);
    validateWithJsonSchemaMock.mockReturnValue({ valid: true });

    // Act
    const result = await validatePipeline(pipeline, asPrisma(db));

    // Assert
    expect(result).toEqual({ valid: true, warnings: [] });
  });

  it("calls agentRegistry.findFirst with agentId, agentVersion, isActive true", async () => {
    // Setup
    const pipeline = createPipeline({
      steps: [createStep({ agentId: "my-agent", agentVersion: "2.0.0" })],
    });
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue({
      inputSchema: null,
      configSchema: null,
    });
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });

    // Act
    await validatePipeline(pipeline, asPrisma(db));

    // Assert
    expect(db.agentRegistry.findFirst).toHaveBeenCalledWith({
      where: {
        agentId: "my-agent",
        agentVersion: "2.0.0",
        isActive: true,
      },
    });
  });
});

describe("getPipelinesValidationMap", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns map of pipeline id to validation result for each pipeline", async () => {
    // Setup
    const pipelines: PipelineWithSteps[] = [
      createPipeline({ id: "p1", name: "P1", steps: [] }),
      createPipeline({ id: "p2", name: "P2", steps: [] }),
    ];
    const db = asPrisma(createDb());

    // Act
    const result = await getPipelinesValidationMap(pipelines, db);

    // Assert
    expect(Object.keys(result)).toHaveLength(2);
    expect(result.p1).toEqual({ valid: true, warnings: [] });
    expect(result.p2).toEqual({ valid: true, warnings: [] });
  });

  it("includes validation result for each pipeline id", async () => {
    // Setup
    const pipelines: PipelineWithSteps[] = [
      createPipeline({ id: "pa", steps: [] }),
      createPipeline({ id: "pb", steps: [createStep()] }),
    ];
    const db = createDb();
    db.agentRegistry.findFirst.mockResolvedValue({
      inputSchema: null,
      configSchema: null,
    });
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });

    // Act
    const result = await getPipelinesValidationMap(pipelines, asPrisma(db));

    // Assert
    expect(result.pa).toBeDefined();
    expect(result.pb).toBeDefined();
    expect(result.pa?.valid).toBe(true);
    expect(result.pb?.valid).toBe(true);
  });
});
