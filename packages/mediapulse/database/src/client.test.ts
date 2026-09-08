/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { superOptions } = vi.hoisted(() => ({
  superOptions: [] as Record<string, unknown>[],
}));

vi.mock("../client/client", () => ({
  PrismaClient: class {
    constructor(options: Record<string, unknown>) {
      superOptions.push(options);
    }
  },
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {},
}));

vi.mock("pg", () => ({
  Pool: class {},
}));

vi.mock("@mediapulse/env", () => ({
  env: {
    MEDIAPULSE_DATABASE_URL:
      "postgresql://user:pass@localhost:5432/db?schema=mediapulse",
    DATABASE_CERT_BASE64: undefined,
  },
}));

import {
  PrismaClientWithSchema,
  TRANSACTION_TIMEOUT_MS,
  TRANSACTION_MAX_WAIT_MS,
} from "./client";

const PRISMA_DEFAULT_TRANSACTION_TIMEOUT_MS = 5_000;

describe("PrismaClientWithSchema", () => {
  beforeEach(() => {
    superOptions.length = 0;
  });

  it("passes an explicit transaction budget to Prisma", () => {
    new PrismaClientWithSchema();
    const options = superOptions[0];

    expect(options?.transactionOptions).toEqual({
      timeout: TRANSACTION_TIMEOUT_MS,
      maxWait: TRANSACTION_MAX_WAIT_MS,
    });
  });

  it("allows more time than the Prisma default a chunked upsert batch overruns", () => {
    expect(TRANSACTION_TIMEOUT_MS).toBeGreaterThan(
      PRISMA_DEFAULT_TRANSACTION_TIMEOUT_MS,
    );
    expect(TRANSACTION_MAX_WAIT_MS).toBeGreaterThan(0);
  });
});
