/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectStringLeaves,
  countExpansionStringMatchesInString,
  countVariableKeyMatchesInString,
  getPipelinesUsingExpansionString,
  getPipelinesUsingVariableKey,
} from "./pipeline-usage";

type UsageDb = NonNullable<Parameters<typeof getPipelinesUsingVariableKey>[1]>;

/**
 * Creates a fake usage DB with configurable Prisma delegate methods.
 *
 * @param overrides - Optional delegate method overrides.
 * @returns DB shape accepted by pipeline usage queries.
 */
const createUsageDb = (overrides?: {
  findSteps?: ReturnType<typeof vi.fn>;
  findPipelines?: ReturnType<typeof vi.fn>;
}): UsageDb => {
  return {
    pipelineStep: {
      findMany: (overrides?.findSteps ??
        vi.fn().mockResolvedValue([])) as never,
    },
    pipeline: {
      findMany: (overrides?.findPipelines ??
        vi.fn().mockResolvedValue([])) as never,
    },
  };
};

describe("collectStringLeaves", () => {
  it("collects string leaves from nested arrays and objects", () => {
    // Setup
    const value = {
      top: "alpha",
      nested: [{ key: "{{KEY}}" }, { child: { value: "db:ticker:id" } }],
      empty: null,
      number: 1,
      bool: true,
    };

    // Act
    const result = collectStringLeaves(value);

    // Assert
    expect(result).toEqual(["alpha", "{{KEY}}", "db:ticker:id"]);
  });
});

describe("countVariableKeyMatchesInString", () => {
  it("matches placeholders with and without inner whitespace", () => {
    // Setup
    const text = "{{KEY}} {{ KEY }} {{OTHER}}";

    // Act
    const result = countVariableKeyMatchesInString(text, "KEY");

    // Assert
    expect(result).toBe(2);
  });
});

describe("countExpansionStringMatchesInString", () => {
  it("matches exact expansion strings only", () => {
    // Setup
    const target = "db:ticker:id";

    // Act
    const exactMatch = countExpansionStringMatchesInString(
      "db:ticker:id",
      target,
    );
    const nonExactMatch = countExpansionStringMatchesInString(
      "prefix db:ticker:id",
      target,
    );

    // Assert
    expect(exactMatch).toBe(1);
    expect(nonExactMatch).toBe(0);
  });
});

describe("getPipelinesUsingVariableKey", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("counts matches from saved agent config used by pipeline steps", async () => {
    // Setup
    const findSteps = vi.fn().mockResolvedValue([
      {
        id: "step-1",
        input: {},
        config: {},
        agentConfig: {
          config: {
            credentials: {
              apiKey: "{{OPENAI_API_KEY}}",
            },
          },
        },
        pipeline: { id: "pipeline-1", name: "Alpha pipeline" },
      },
      {
        id: "step-2",
        input: null,
        config: null,
        agentConfig: null,
        pipeline: { id: "pipeline-2", name: "Beta pipeline" },
      },
    ]);
    const findPipelines = vi.fn().mockResolvedValue([
      {
        id: "pipeline-1",
        name: "Alpha pipeline",
        executionConfig: null,
      },
      {
        id: "pipeline-2",
        name: "Beta pipeline",
        executionConfig: null,
      },
    ]);
    const db = createUsageDb({ findSteps, findPipelines });

    // Act
    const result = await getPipelinesUsingVariableKey("OPENAI_API_KEY", db);

    // Assert
    expect(result).toEqual([
      {
        id: "pipeline-1",
        name: "Alpha pipeline",
        matchCount: 1,
        matchedStepIds: ["step-1"],
      },
    ]);
  });

  it("deduplicates by pipeline and aggregates matches across steps", async () => {
    // Setup
    const findSteps = vi.fn().mockResolvedValue([
      {
        id: "step-1",
        input: { first: "{{API_KEY}}", second: "{{ API_KEY }}" },
        config: null,
        pipeline: { id: "pipeline-1", name: "Alpha pipeline" },
      },
      {
        id: "step-2",
        input: ["{{API_KEY}}"],
        config: { ignored: "{{OTHER}}" },
        pipeline: { id: "pipeline-1", name: "Alpha pipeline" },
      },
      {
        id: "step-3",
        input: { nested: { value: "{{API_KEY}}" } },
        config: {},
        pipeline: { id: "pipeline-2", name: "Beta pipeline" },
      },
    ]);
    const findPipelines = vi.fn().mockResolvedValue([
      {
        id: "pipeline-1",
        name: "Alpha pipeline",
        executionConfig: null,
      },
      {
        id: "pipeline-2",
        name: "Beta pipeline",
        executionConfig: { metadata: "uses {{API_KEY}}" },
      },
    ]);
    const db = createUsageDb({ findSteps, findPipelines });

    // Act
    const result = await getPipelinesUsingVariableKey("API_KEY", db);

    // Assert
    expect(result).toEqual([
      {
        id: "pipeline-1",
        name: "Alpha pipeline",
        matchCount: 3,
        matchedStepIds: ["step-1", "step-2"],
      },
      {
        id: "pipeline-2",
        name: "Beta pipeline",
        matchCount: 2,
        matchedStepIds: ["step-3"],
      },
    ]);
  });

  it("returns empty list for blank key", async () => {
    // Setup
    const findSteps = vi.fn();
    const findPipelines = vi.fn();
    const db = createUsageDb({ findSteps, findPipelines });

    // Act
    const result = await getPipelinesUsingVariableKey("   ", db);

    // Assert
    expect(result).toEqual([]);
    expect(findSteps).not.toHaveBeenCalled();
    expect(findPipelines).not.toHaveBeenCalled();
  });
});

describe("getPipelinesUsingExpansionString", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("matches exact expansion string and scopes by integration", async () => {
    // Setup
    const findSteps = vi.fn().mockResolvedValue([
      {
        id: "step-1",
        input: { one: "db:ticker:id", two: "db:ticker:id?take=10" },
        config: ["db:ticker:id"],
        pipeline: { id: "pipeline-1", name: "Alpha pipeline" },
      },
    ]);
    const findPipelines = vi.fn().mockResolvedValue([
      {
        id: "pipeline-1",
        name: "Alpha pipeline",
        executionConfig: { value: "db:ticker:id" },
      },
    ]);
    const db = createUsageDb({ findSteps, findPipelines });

    // Act
    const result = await getPipelinesUsingExpansionString(
      "integration-1",
      "db:ticker:id",
      db,
    );

    // Assert
    expect(findSteps).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pipeline: { domainIntegrationId: "integration-1" } },
      }),
    );
    expect(findPipelines).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { domainIntegrationId: "integration-1" },
      }),
    );
    expect(result).toEqual([
      {
        id: "pipeline-1",
        name: "Alpha pipeline",
        matchCount: 3,
        matchedStepIds: ["step-1"],
      },
    ]);
  });
});
