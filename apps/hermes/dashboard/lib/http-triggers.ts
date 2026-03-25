import type { Prisma } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";

type Db = typeof prisma;

const httpTriggerListInclude = {
  pipeline: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.HttpTriggerInclude;

export type HttpTriggersPageResult = {
  httpTriggers: Prisma.HttpTriggerGetPayload<{
    include: typeof httpTriggerListInclude;
  }>[];
  total: number;
  page: number;
  pageSize: number;
};

export type HttpTriggerSortField = "name" | "created" | "enabled" | "method";
export type HttpTriggerSortDir = "asc" | "desc";

const httpTriggerSearchWhere = (
  search: string | undefined,
): Prisma.HttpTriggerWhereInput | undefined => {
  const term = search?.trim();
  if (!term) return undefined;
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ],
  };
};

const httpTriggerOrderBy = (
  sortBy: HttpTriggerSortField,
  sortDir: HttpTriggerSortDir,
): Prisma.HttpTriggerOrderByWithRelationInput => {
  const dir: Prisma.SortOrder = sortDir;
  if (sortBy === "created") return { createdAt: dir };
  if (sortBy === "enabled") return { enabled: dir };
  if (sortBy === "method") return { method: dir };
  return { name: dir };
};

/**
 * Fetches paginated HTTP triggers with optional search and sorting.
 */
export const getHttpTriggersPage = async (
  page: number,
  pageSize: number,
  options?: {
    search?: string;
    sortBy?: HttpTriggerSortField;
    sortDir?: HttpTriggerSortDir;
  },
  db: Db = prisma,
): Promise<HttpTriggersPageResult> => {
  const skip = (page - 1) * pageSize;
  const where = httpTriggerSearchWhere(options?.search);
  const orderBy = httpTriggerOrderBy(
    options?.sortBy ?? "name",
    options?.sortDir ?? "asc",
  );
  const args = {
    where,
    skip,
    take: pageSize,
    orderBy,
    include: httpTriggerListInclude,
  } satisfies Prisma.HttpTriggerFindManyArgs;
  const [httpTriggers, total] = await Promise.all([
    db.httpTrigger.findMany(args),
    db.httpTrigger.count({ where }),
  ]);
  return { httpTriggers, total, page, pageSize };
};

/**
 * Fetches one HTTP trigger by id with its pipeline.
 */
export const getHttpTriggerById = async (
  triggerId: string,
  db: Db = prisma,
): Promise<Prisma.HttpTriggerGetPayload<{
  include: {
    pipeline: true;
    createdBy: { select: { id: true; name: true; email: true } };
  };
}> | null> => {
  return db.httpTrigger.findUnique({
    where: { id: triggerId },
    include: {
      pipeline: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
};

export type HttpTriggerExecutionRow = Prisma.HttpTriggerExecutionGetPayload<{
  select: {
    id: true;
    executionTime: true;
    enqueueStatus: true;
    runStatus: true;
    jobsCreated: true;
    jobsEnqueued: true;
    succeededInvocationCount: true;
    failedInvocationCount: true;
    errors: true;
    createdAt: true;
  };
}>;

export type HttpTriggerExecutionsPageResult = {
  executions: HttpTriggerExecutionRow[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Fetches paginated execution rows for one HTTP trigger.
 */
export const getHttpTriggerExecutionsPage = async (
  httpTriggerId: string,
  page: number,
  pageSize: number,
  db: Db = prisma,
): Promise<HttpTriggerExecutionsPageResult> => {
  const where = {
    httpTriggerId,
  } satisfies Prisma.HttpTriggerExecutionWhereInput;
  const skip = (page - 1) * pageSize;
  const args = {
    where,
    skip,
    take: pageSize,
    orderBy: { executionTime: "desc" },
    select: {
      id: true,
      executionTime: true,
      enqueueStatus: true,
      runStatus: true,
      jobsCreated: true,
      jobsEnqueued: true,
      succeededInvocationCount: true,
      failedInvocationCount: true,
      errors: true,
      createdAt: true,
    },
  } satisfies Prisma.HttpTriggerExecutionFindManyArgs;
  const [executions, total] = await Promise.all([
    db.httpTriggerExecution.findMany(args),
    db.httpTriggerExecution.count({ where }),
  ]);
  return { executions, total, page, pageSize };
};

export type HttpTriggerExecutionDetail = {
  execution: Prisma.HttpTriggerExecutionGetPayload<{
    select: {
      id: true;
      executionTime: true;
      enqueueStatus: true;
      runStatus: true;
      effectiveExecutionConfig: true;
      jobsCreated: true;
      jobsEnqueued: true;
      succeededInvocationCount: true;
      failedInvocationCount: true;
      errors: true;
      metadata: true;
      createdAt: true;
    };
  }>;
  pipeline: { id: string; name: string } | null;
  trigger: { id: string; name: string };
  stepExecutions: Array<{
    pipelineStepId: string;
    stepOrder: number;
    agentId: string;
    agentVersion: string;
    expectedInvocationCount: number;
    succeededCount: number;
    failedCount: number;
    rollupStatus: string;
  }>;
  invocations: Array<{
    jobId: string;
    status: string;
    agentId: string;
    pipelineStepId: string | null;
    params: unknown;
    invocationConfig: unknown | null;
    error: unknown;
    agentResponse: unknown;
    semanticStatus: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    dataQueueAttempts: number | null;
    dataQueueMaxAttempts: number | null;
  }>;
};

/**
 * Loads one HTTP trigger execution with step rollups and invocation rows.
 */
export const getHttpTriggerExecutionDetail = async (
  httpTriggerId: string,
  executionId: string,
  db: Db = prisma,
): Promise<HttpTriggerExecutionDetail | null> => {
  const row = await db.httpTriggerExecution.findFirst({
    where: { id: executionId, httpTriggerId },
    include: {
      httpTrigger: {
        select: {
          id: true,
          name: true,
          pipelineId: true,
        },
      },
      httpTriggerStepExecutions: {
        include: {
          pipelineStep: {
            select: {
              id: true,
              order: true,
              agentId: true,
              agentVersion: true,
            },
          },
        },
      },
      agentJobExecutions: {
        orderBy: { enqueuedAt: "asc" },
        select: {
          jobId: true,
          status: true,
          agentId: true,
          pipelineStepId: true,
          params: true,
          invocationConfig: true,
          error: true,
          agentResponse: true,
          semanticStatus: true,
          startedAt: true,
          completedAt: true,
          dataQueueAttempts: true,
          dataQueueMaxAttempts: true,
        },
      },
    },
  });
  if (!row) return null;
  const pipeline = await db.pipeline.findUnique({
    where: { id: row.httpTrigger.pipelineId },
    select: { id: true, name: true },
  });
  return {
    execution: {
      id: row.id,
      executionTime: row.executionTime,
      enqueueStatus: row.enqueueStatus,
      runStatus: row.runStatus,
      effectiveExecutionConfig: row.effectiveExecutionConfig,
      jobsCreated: row.jobsCreated,
      jobsEnqueued: row.jobsEnqueued,
      succeededInvocationCount: row.succeededInvocationCount,
      failedInvocationCount: row.failedInvocationCount,
      errors: row.errors,
      metadata: row.metadata,
      createdAt: row.createdAt,
    },
    pipeline,
    trigger: {
      id: row.httpTrigger.id,
      name: row.httpTrigger.name,
    },
    stepExecutions: row.httpTriggerStepExecutions
      .map((item) => ({
        pipelineStepId: item.pipelineStepId,
        stepOrder: item.pipelineStep.order,
        agentId: item.pipelineStep.agentId,
        agentVersion: item.pipelineStep.agentVersion,
        expectedInvocationCount: item.expectedInvocationCount,
        succeededCount: item.succeededCount,
        failedCount: item.failedCount,
        rollupStatus: item.rollupStatus,
      }))
      .sort((left, right) => left.stepOrder - right.stepOrder),
    invocations: row.agentJobExecutions.map((job) => ({
      jobId: job.jobId,
      status: job.status,
      agentId: job.agentId,
      pipelineStepId: job.pipelineStepId,
      params: job.params,
      invocationConfig: job.invocationConfig,
      error: job.error,
      agentResponse: job.agentResponse,
      semanticStatus: job.semanticStatus,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      dataQueueAttempts: job.dataQueueAttempts,
      dataQueueMaxAttempts: job.dataQueueMaxAttempts,
    })),
  };
};
