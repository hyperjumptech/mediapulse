/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateDataSourceExpressions } from "@/lib/step-input-expansion";

import { collectEmptyRequiredStringErrors } from "./validate-required-fields";
import {
  getPipelinesValidationMap,
  type PipelineValidationDb,
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

type PipelineStep = PipelineWithSteps["steps"][number];

type RegistryAgentRow = {
  agentId: string;
  agentVersion: string;
  domainIntegrationId: string;
  inputSchema: unknown;
  configSchema: unknown;
};

const createPipeline = (
  overrides: Partial<PipelineWithSteps> & { steps: PipelineWithSteps["steps"] },
): PipelineWithSteps => ({
  id: "p1",
  name: "Pipeline 1",
  domainIntegrationId: "di-1",
  ...overrides,
});

const createStep = (overrides: Partial<PipelineStep> = {}): PipelineStep => ({
  id: "s1",
  order: 0,
  agentId: "agent-a",
  agentVersion: "1.0.0",
  agentConfigId: null,
  agentContractId: null,
  input: {},
  config: {},
  ...overrides,
});

const createRegistryAgent = (
  overrides: Partial<RegistryAgentRow> = {},
): RegistryAgentRow => ({
  agentId: "agent-a",
  agentVersion: "1.0.0",
  domainIntegrationId: "di-1",
  inputSchema: null,
  configSchema: null,
  ...overrides,
});

const createDb = () => ({
  agentRegistry: { findMany: vi.fn().mockResolvedValue([]) },
  agentConfig: { findMany: vi.fn().mockResolvedValue([]) },
});

const asValidationDb = (
  db: ReturnType<typeof createDb>,
): PipelineValidationDb => db as unknown as PipelineValidationDb;

const countDatabaseCalls = (db: ReturnType<typeof createDb>): number =>
  db.agentRegistry.findMany.mock.calls.length +
  db.agentConfig.findMany.mock.calls.length;

describe("validatePipeline", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    validateDataSourceExpressionsMock.mockReset();
    collectEmptyRequiredStringErrorsMock.mockReset();
    validateWithJsonSchemaMock.mockReset();
  });

  it("returns valid true and empty warnings without querying when pipeline has no steps", async () => {
    // Setup
    const pipeline = createPipeline({ steps: [] });
    const db = createDb();

    // Act
    const result = await validatePipeline(pipeline, asValidationDb(db));

    // Assert
    expect(result).toEqual({ valid: true, warnings: [] });
    expect(countDatabaseCalls(db)).toBe(0);
  });

  it("skips step when step is undefined (sparse array) and keeps step numbering", async () => {
    // Setup
    const pipeline = createPipeline({
      steps: [
        createStep(),
        undefined as never,
        createStep({ id: "s3", agentId: "missing" }),
      ],
    });
    const db = createDb();
    db.agentRegistry.findMany.mockResolvedValue([createRegistryAgent()]);
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });

    // Act
    const result = await validatePipeline(pipeline, asValidationDb(db));

    // Assert
    expect(result).toEqual({
      valid: false,
      warnings: ["Step 3 (missing@1.0.0): agent not found in registry"],
    });
    expect(validateDataSourceExpressionsMock).toHaveBeenCalledTimes(1);
  });

  it("adds warning and continues when agent not found in registry", async () => {
    // Setup
    const pipeline = createPipeline({
      steps: [createStep({ agentId: "missing", agentVersion: "1.0.0" })],
    });
    const db = createDb();

    // Act
    const result = await validatePipeline(pipeline, asValidationDb(db));

    // Assert
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain(
      "Step 1 (missing@1.0.0): agent not found in registry",
    );
  });

  it("does not match a registry agent from another domain integration", async () => {
    // Setup
    const pipeline = createPipeline({ steps: [createStep()] });
    const db = createDb();
    db.agentRegistry.findMany.mockResolvedValue([
      createRegistryAgent({ domainIntegrationId: "di-2" }),
    ]);

    // Act
    const result = await validatePipeline(pipeline, asValidationDb(db));

    // Assert
    expect(result).toEqual({
      valid: false,
      warnings: ["Step 1 (agent-a@1.0.0): agent not found in registry"],
    });
  });

  it("normalizes non-object input and config to empty object", async () => {
    // Setup
    const pipeline = createPipeline({
      steps: [
        createStep({
          input: "not-an-object" as never,
          config: ["array"] as never,
        }),
      ],
    });
    const db = createDb();
    db.agentRegistry.findMany.mockResolvedValue([createRegistryAgent()]);
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });

    // Act
    await validatePipeline(pipeline, asValidationDb(db));

    // Assert
    expect(validateDataSourceExpressionsMock).toHaveBeenCalledWith({});
  });

  it("adds warning when data source expressions are invalid", async () => {
    // Setup
    const pipeline = createPipeline({
      steps: [createStep({ input: { key: "db:invalid" } })],
    });
    const db = createDb();
    db.agentRegistry.findMany.mockResolvedValue([createRegistryAgent()]);
    validateDataSourceExpressionsMock.mockReturnValue({
      valid: false,
      errors: ['Param "key": invalid data source format', "second error"],
    });

    // Act
    const result = await validatePipeline(pipeline, asValidationDb(db));

    // Assert
    expect(result).toEqual({
      valid: false,
      warnings: [
        'Step 1 (agent-a@1.0.0) input: Param "key": invalid data source format; second error',
      ],
    });
  });

  it("adds input warning when empty required string errors exist", async () => {
    // Setup
    const inputSchema = { type: "object", required: ["name"] };
    const pipeline = createPipeline({
      steps: [createStep({ input: { name: "" } })],
    });
    const db = createDb();
    db.agentRegistry.findMany.mockResolvedValue([
      createRegistryAgent({ inputSchema }),
    ]);
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([
      "/ name is required but empty",
    ]);
    validateWithJsonSchemaMock.mockReturnValue({ valid: true });

    // Act
    const result = await validatePipeline(pipeline, asValidationDb(db));

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
    db.agentRegistry.findMany.mockResolvedValue([
      createRegistryAgent({ inputSchema }),
    ]);
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([]);
    validateWithJsonSchemaMock.mockReturnValue({
      valid: false,
      errors: ["/ x is required"],
    });

    // Act
    const result = await validatePipeline(pipeline, asValidationDb(db));

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
    db.agentRegistry.findMany.mockResolvedValue([createRegistryAgent()]);
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });

    // Act
    const result = await validatePipeline(pipeline, asValidationDb(db));

    // Assert
    expect(collectEmptyRequiredStringErrorsMock).not.toHaveBeenCalled();
    expect(validateWithJsonSchemaMock).not.toHaveBeenCalled();
    expect(result.valid).toBe(true);
  });

  it("adds config warning when saved config not found for agentConfigId", async () => {
    // Setup
    const configSchema = { type: "object", required: ["option"] };
    const pipeline = createPipeline({
      steps: [createStep({ agentConfigId: "config-1", config: {} })],
    });
    const db = createDb();
    db.agentRegistry.findMany.mockResolvedValue([
      createRegistryAgent({ configSchema }),
    ]);
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([]);
    validateWithJsonSchemaMock.mockReturnValue({ valid: true });

    // Act
    const result = await validatePipeline(pipeline, asValidationDb(db));

    // Assert
    expect(result).toEqual({
      valid: false,
      warnings: ["Step 1 (agent-a@1.0.0): saved config not found"],
    });
    expect(validateWithJsonSchemaMock).toHaveBeenCalledWith(configSchema, {});
  });

  it("does not warn about a missing saved config when the agent has no configSchema", async () => {
    // Setup
    const pipeline = createPipeline({
      steps: [createStep({ agentConfigId: "config-1" })],
    });
    const db = createDb();
    db.agentRegistry.findMany.mockResolvedValue([createRegistryAgent()]);
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });

    // Act
    const result = await validatePipeline(pipeline, asValidationDb(db));

    // Assert
    expect(result).toEqual({ valid: true, warnings: [] });
  });

  it("uses saved config as effectiveConfig when agentConfigId is set", async () => {
    // Setup
    const configSchema = { type: "object" };
    const pipeline = createPipeline({
      steps: [
        createStep({ agentConfigId: "config-1", config: { ignored: true } }),
      ],
    });
    const db = createDb();
    db.agentRegistry.findMany.mockResolvedValue([
      createRegistryAgent({ configSchema }),
    ]);
    db.agentConfig.findMany.mockResolvedValue([
      { id: "config-1", config: { option: "value" } },
    ]);
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([]);
    validateWithJsonSchemaMock.mockReturnValue({ valid: true });

    // Act
    await validatePipeline(pipeline, asValidationDb(db));

    // Assert
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
    db.agentRegistry.findMany.mockResolvedValue([
      createRegistryAgent({ configSchema }),
    ]);
    db.agentConfig.findMany.mockResolvedValue([
      { id: "config-1", config: "string-not-object" },
    ]);
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([]);
    validateWithJsonSchemaMock.mockReturnValue({ valid: true });

    // Act
    await validatePipeline(pipeline, asValidationDb(db));

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
    db.agentRegistry.findMany.mockResolvedValue([
      createRegistryAgent({ configSchema }),
    ]);
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([
      "/ option is required but empty",
    ]);
    validateWithJsonSchemaMock.mockReturnValue({ valid: true });

    // Act
    const result = await validatePipeline(pipeline, asValidationDb(db));

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
    db.agentRegistry.findMany.mockResolvedValue([
      createRegistryAgent({ configSchema }),
    ]);
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([]);
    validateWithJsonSchemaMock.mockReturnValue({
      valid: false,
      errors: ["/ option required"],
    });

    // Act
    const result = await validatePipeline(pipeline, asValidationDb(db));

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
    db.agentRegistry.findMany.mockResolvedValue([
      createRegistryAgent({
        inputSchema: { type: "object" },
        configSchema: { type: "object" },
      }),
    ]);
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([]);
    validateWithJsonSchemaMock.mockReturnValue({ valid: true });

    // Act
    const result = await validatePipeline(pipeline, asValidationDb(db));

    // Assert
    expect(result).toEqual({ valid: true, warnings: [] });
  });

  it("queries active registry agents scoped to the pipeline domain integration", async () => {
    // Setup
    const pipeline = createPipeline({
      steps: [
        createStep({ agentId: "my-agent", agentVersion: "2.0.0" }),
        createStep({ id: "s2", agentId: "other-agent", agentVersion: "1.0.0" }),
      ],
    });
    const db = createDb();
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });

    // Act
    await validatePipeline(pipeline, asValidationDb(db));

    // Assert
    expect(db.agentRegistry.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [
          {
            domainIntegrationId: "di-1",
            agentId: "my-agent",
            agentVersion: "2.0.0",
          },
          {
            domainIntegrationId: "di-1",
            agentId: "other-agent",
            agentVersion: "1.0.0",
          },
        ],
      },
      select: {
        agentId: true,
        agentVersion: true,
        domainIntegrationId: true,
        inputSchema: true,
        configSchema: true,
      },
    });
    expect(db.agentConfig.findMany).not.toHaveBeenCalled();
  });
});

describe("getPipelinesValidationMap", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    validateDataSourceExpressionsMock.mockReset();
    collectEmptyRequiredStringErrorsMock.mockReset();
    validateWithJsonSchemaMock.mockReset();
    validateDataSourceExpressionsMock.mockReturnValue({ valid: true });
    collectEmptyRequiredStringErrorsMock.mockReturnValue([]);
    validateWithJsonSchemaMock.mockReturnValue({ valid: true });
  });

  it("returns map of pipeline id to validation result for each pipeline", async () => {
    // Setup
    const pipelines: PipelineWithSteps[] = [
      createPipeline({ id: "p1", name: "P1", steps: [] }),
      createPipeline({ id: "p2", name: "P2", steps: [] }),
    ];
    const db = createDb();

    // Act
    const result = await getPipelinesValidationMap(
      pipelines,
      asValidationDb(db),
    );

    // Assert
    expect(result).toEqual({
      p1: { valid: true, warnings: [] },
      p2: { valid: true, warnings: [] },
    });
    expect(countDatabaseCalls(db)).toBe(0);
  });

  it("uses two queries regardless of pipeline and step count", async () => {
    // Setup
    const stepCount = 5;
    const pipelines = Array.from({ length: 25 }, (_, pipelineIndex) =>
      createPipeline({
        id: `pipeline-${pipelineIndex}`,
        steps: Array.from({ length: stepCount }, (_, stepIndex) =>
          createStep({
            id: `pipeline-${pipelineIndex}-step-${stepIndex}`,
            order: stepIndex,
            agentId: `agent-${stepIndex}`,
            agentConfigId: `config-${stepIndex}`,
          }),
        ),
      }),
    );
    const db = createDb();
    const registryAgents = Array.from({ length: stepCount }, (_, stepIndex) =>
      createRegistryAgent({
        agentId: `agent-${stepIndex}`,
        configSchema: { type: "object" },
      }),
    );
    const savedAgentConfigs = Array.from(
      { length: stepCount },
      (_, stepIndex) => ({ id: `config-${stepIndex}`, config: {} }),
    );
    db.agentRegistry.findMany.mockResolvedValue(registryAgents);
    db.agentConfig.findMany.mockResolvedValue(savedAgentConfigs);

    // Act
    const result = await getPipelinesValidationMap(
      pipelines,
      asValidationDb(db),
    );

    // Assert
    const registryQuery = db.agentRegistry.findMany.mock.calls[0]?.[0];
    const configQuery = db.agentConfig.findMany.mock.calls[0]?.[0];

    expect(countDatabaseCalls(db)).toBe(2);
    expect(registryQuery.where.OR).toHaveLength(stepCount);
    expect(configQuery).toEqual({
      where: {
        id: {
          in: ["config-0", "config-1", "config-2", "config-3", "config-4"],
        },
      },
      select: { id: true, config: true },
    });
    expect(Object.keys(result)).toHaveLength(25);
    expect(Object.values(result).every((validation) => validation.valid)).toBe(
      true,
    );
  });

  it("keeps the same agent key separate per domain integration", async () => {
    // Setup
    const pipelines = [
      createPipeline({
        id: "pa",
        domainIntegrationId: "di-1",
        steps: [createStep()],
      }),
      createPipeline({
        id: "pb",
        domainIntegrationId: "di-2",
        steps: [createStep()],
      }),
    ];
    const db = createDb();
    db.agentRegistry.findMany.mockResolvedValue([
      createRegistryAgent({ domainIntegrationId: "di-1" }),
    ]);

    // Act
    const result = await getPipelinesValidationMap(
      pipelines,
      asValidationDb(db),
    );

    // Assert
    expect(db.agentRegistry.findMany.mock.calls[0]?.[0].where.OR).toEqual([
      {
        domainIntegrationId: "di-1",
        agentId: "agent-a",
        agentVersion: "1.0.0",
      },
      {
        domainIntegrationId: "di-2",
        agentId: "agent-a",
        agentVersion: "1.0.0",
      },
    ]);
    expect(result).toEqual({
      pa: { valid: true, warnings: [] },
      pb: {
        valid: false,
        warnings: ["Step 1 (agent-a@1.0.0): agent not found in registry"],
      },
    });
  });
});

describe("getPipelinesValidationMap with real schema validators", () => {
  const searchInputSchema = {
    type: "object",
    properties: { query: { type: "string" }, limit: { type: "number" } },
    required: ["query"],
  };
  const deliveryConfigSchema = {
    type: "object",
    properties: { apiKey: { type: "string" } },
    required: ["apiKey"],
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    const actualJsonSchema = await vi.importActual<{
      validateWithJsonSchema: typeof validateWithJsonSchema;
    }>("./validate-json-schema");
    const actualRequiredFields = await vi.importActual<{
      collectEmptyRequiredStringErrors: typeof collectEmptyRequiredStringErrors;
    }>("./validate-required-fields");
    validateWithJsonSchemaMock.mockReset();
    collectEmptyRequiredStringErrorsMock.mockReset();
    validateDataSourceExpressionsMock.mockReset();
    validateWithJsonSchemaMock.mockImplementation(
      actualJsonSchema.validateWithJsonSchema,
    );
    collectEmptyRequiredStringErrorsMock.mockImplementation(
      actualRequiredFields.collectEmptyRequiredStringErrors,
    );
    validateDataSourceExpressionsMock.mockImplementation((params) =>
      "source" in params
        ? { valid: false, errors: ['Param "source": invalid data source'] }
        : { valid: true },
    );
  });

  it("produces the same ordered warnings for every failure kind", async () => {
    // Setup
    const pipeline = createPipeline({
      id: "p-mixed",
      steps: [
        createStep({ id: "s1", agentId: "missing-agent" }),
        createStep({
          id: "s2",
          agentId: "search",
          input: { query: "", source: "db:bad" },
        }),
        createStep({
          id: "s3",
          agentId: "search",
          input: { query: "news", limit: "ten" },
        }),
        createStep({
          id: "s4",
          agentId: "delivery",
          agentConfigId: "missing-config",
          config: {},
        }),
        createStep({
          id: "s5",
          agentId: "delivery",
          agentConfigId: "saved-config",
          config: { apiKey: "ignored-because-saved-config-wins" },
        }),
      ],
    });
    const db = createDb();
    db.agentRegistry.findMany.mockResolvedValue([
      createRegistryAgent({
        agentId: "search",
        inputSchema: searchInputSchema,
      }),
      createRegistryAgent({
        agentId: "delivery",
        configSchema: deliveryConfigSchema,
      }),
    ]);
    db.agentConfig.findMany.mockResolvedValue([
      { id: "saved-config", config: { apiKey: 42 } },
    ]);

    // Act
    const validationById = await getPipelinesValidationMap(
      [pipeline],
      asValidationDb(db),
    );
    const singleValidation = await validatePipeline(
      pipeline,
      asValidationDb(db),
    );

    // Assert
    const expectedValidation = {
      valid: false,
      warnings: [
        "Step 1 (missing-agent@1.0.0): agent not found in registry",
        'Step 2 (search@1.0.0) input: Param "source": invalid data source',
        "Step 2 (search@1.0.0) input: /query is required",
        "Step 3 (search@1.0.0) input: /limit must be number",
        "Step 4 (delivery@1.0.0): saved config not found",
        "Step 4 (delivery@1.0.0) config: /apiKey is required",
        "Step 4 (delivery@1.0.0) config: / must have required property 'apiKey'",
        "Step 5 (delivery@1.0.0) config: /apiKey is required",
        "Step 5 (delivery@1.0.0) config: /apiKey must be string",
      ],
    };

    expect(validationById["p-mixed"]).toEqual(expectedValidation);
    expect(singleValidation).toEqual(expectedValidation);
    expect(db.agentRegistry.findMany).toHaveBeenCalledTimes(2);
    expect(db.agentConfig.findMany).toHaveBeenCalledTimes(2);
  });
});
