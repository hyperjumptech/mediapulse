import { vi } from "vitest";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";

type MockTicker = {
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

type MockAgent = {
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

type MockPipeline = {
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

type MockSchedule = {
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

type MockDb = {
  ticker: MockTicker;
  agent: MockAgent;
  pipeline: MockPipeline;
  schedule: MockSchedule;
};

/**
 * Creates a mock entity (ticker, agent, etc.) with all common Prisma methods.
 *
 * @returns A mocked entity object with vi.fn() for all methods
 */
const createMockEntity = () => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
});

/**
 * Creates a mock Prisma database client for testing.
 *
 * @returns A mocked database client
 */
export const createMockDb = (): MockDb => ({
  ticker: createMockEntity(),
  agent: createMockEntity(),
  pipeline: createMockEntity(),
  schedule: createMockEntity(),
});

/**
 * Casts a mock database to PrismaClientWithSchema for type compatibility.
 *
 * @param db - The mock database
 * @returns The database cast to PrismaClientWithSchema
 */
export const asDb = (db: MockDb): PrismaClientWithSchema =>
  db as unknown as PrismaClientWithSchema;
