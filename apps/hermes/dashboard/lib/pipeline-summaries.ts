import type { Prisma, PrismaClient } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";

import type { SortDirection } from "./list-page-params";
import type { PipelineValidationResult } from "./pipeline-status";
import {
  getPipelinesValidationMap,
  pipelineValidationStepsArgs,
  type PipelineValidationDb,
} from "./validate-pipeline";

export type PipelineSummariesDb = PipelineValidationDb & {
  pipeline: Pick<PrismaClient["pipeline"], "findMany" | "count">;
};

export type PipelineSortField = "name" | "updated";

export type PipelineSummariesQuery = {
  page: number;
  pageSize: number;
  search?: string;
  sortBy: PipelineSortField;
  sortDir: SortDirection;
};

const pipelineSummarySelect = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  updatedAt: true,
  createdById: true,
  createdBy: { select: { id: true, name: true, email: true } },
  domainIntegrationId: true,
  steps: pipelineValidationStepsArgs,
  _count: { select: { steps: true } },
} satisfies Prisma.PipelineSelect;

type PipelineSummaryRecord = Prisma.PipelineGetPayload<{
  select: typeof pipelineSummarySelect;
}>;

export type PipelineSummary = Pick<
  PipelineSummaryRecord,
  | "id"
  | "name"
  | "description"
  | "isActive"
  | "updatedAt"
  | "createdById"
  | "createdBy"
> & {
  stepCount: number;
  validation: PipelineValidationResult;
};

export type PipelineSummariesPage = {
  pipelines: PipelineSummary[];
  total: number;
  page: number;
  pageSize: number;
};

const pipelineListItemSelect = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  updatedAt: true,
  _count: { select: { steps: true } },
} satisfies Prisma.PipelineSelect;

type PipelineListItemRecord = Prisma.PipelineGetPayload<{
  select: typeof pipelineListItemSelect;
}>;

export type PipelineListItem = Pick<
  PipelineListItemRecord,
  "id" | "name" | "description" | "isActive" | "updatedAt"
> & {
  stepCount: number;
};

export type PipelineListItemsPage = {
  pipelines: PipelineListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type PipelineListItemsDb = {
  pipeline: Pick<PrismaClient["pipeline"], "findMany" | "count">;
};

const MISSING_VALIDATION: PipelineValidationResult = {
  valid: false,
  warnings: [],
};

const pipelineSearchWhere = (
  search: string | undefined,
): Prisma.PipelineWhereInput | undefined => {
  const term = search?.trim();
  if (!term) {
    return undefined;
  }

  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ],
  };
};

const pipelineOrderBy = (
  sortBy: PipelineSortField,
  sortDir: SortDirection,
): Prisma.PipelineOrderByWithRelationInput[] => {
  const primaryOrder =
    sortBy === "name" ? { name: sortDir } : { updatedAt: sortDir };

  return [primaryOrder, { id: "asc" }];
};

const toPipelineSummary = (
  pipeline: PipelineSummaryRecord,
  validation: PipelineValidationResult,
): PipelineSummary => ({
  id: pipeline.id,
  name: pipeline.name,
  description: pipeline.description,
  isActive: pipeline.isActive,
  updatedAt: pipeline.updatedAt,
  createdById: pipeline.createdById,
  createdBy: pipeline.createdBy,
  stepCount: pipeline._count.steps,
  validation,
});

export const getPipelineSummariesPage = async (
  { page, pageSize, search, sortBy, sortDir }: PipelineSummariesQuery,
  db: PipelineSummariesDb = prisma,
): Promise<PipelineSummariesPage> => {
  const where = pipelineSearchWhere(search);
  const findManyArgs = {
    where,
    orderBy: pipelineOrderBy(sortBy, sortDir),
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: pipelineSummarySelect,
  } satisfies Prisma.PipelineFindManyArgs;
  const countArgs = { where } satisfies Prisma.PipelineCountArgs;
  const [pipelines, total] = await Promise.all([
    db.pipeline.findMany(findManyArgs),
    db.pipeline.count(countArgs),
  ]);
  const validationById = await getPipelinesValidationMap(pipelines, db);
  const summaries = pipelines.map((pipeline) => {
    const validation = validationById[pipeline.id] ?? MISSING_VALIDATION;

    return toPipelineSummary(pipeline, validation);
  });

  return { pipelines: summaries, total, page, pageSize };
};

const toPipelineListItem = (
  pipeline: PipelineListItemRecord,
): PipelineListItem => ({
  id: pipeline.id,
  name: pipeline.name,
  description: pipeline.description,
  isActive: pipeline.isActive,
  stepCount: pipeline._count.steps,
  updatedAt: pipeline.updatedAt,
});

export const getPipelineListItemsPage = async (
  { page, pageSize, search, sortBy, sortDir }: PipelineSummariesQuery,
  db: PipelineListItemsDb = prisma,
): Promise<PipelineListItemsPage> => {
  const where = pipelineSearchWhere(search);
  const findManyArgs = {
    where,
    orderBy: pipelineOrderBy(sortBy, sortDir),
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: pipelineListItemSelect,
  } satisfies Prisma.PipelineFindManyArgs;
  const countArgs = { where } satisfies Prisma.PipelineCountArgs;
  const [pipelines, total] = await Promise.all([
    db.pipeline.findMany(findManyArgs),
    db.pipeline.count(countArgs),
  ]);

  return {
    pipelines: pipelines.map(toPipelineListItem),
    total,
    page,
    pageSize,
  };
};
