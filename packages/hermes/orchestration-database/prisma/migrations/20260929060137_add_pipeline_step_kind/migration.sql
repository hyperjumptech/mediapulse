-- CreateEnum
CREATE TYPE "PipelineStepKind" AS ENUM ('agent', 'pipeline');

-- AlterTable
ALTER TABLE "pipeline_step" ADD COLUMN     "kind" "PipelineStepKind" NOT NULL DEFAULT 'agent',
ADD COLUMN     "target_pipeline_id" TEXT,
ALTER COLUMN "agent_id" DROP NOT NULL,
ALTER COLUMN "agent_version" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "pipeline_step_target_pipeline_id_idx" ON "pipeline_step"("target_pipeline_id");

-- AddForeignKey
ALTER TABLE "pipeline_step" ADD CONSTRAINT "pipeline_step_target_pipeline_id_fkey" FOREIGN KEY ("target_pipeline_id") REFERENCES "pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
