-- AlterTable
ALTER TABLE "newsletter" ADD COLUMN     "agent_version" TEXT,
ADD COLUMN     "completion_tokens" INTEGER,
ADD COLUMN     "config_snapshot_id" TEXT,
ADD COLUMN     "config_version" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "prompt_hash" TEXT,
ADD COLUMN     "prompt_tokens" INTEGER,
ADD COLUMN     "total_tokens" INTEGER;
