-- CreateTable
CREATE TABLE "agent_contract" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brief" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "agent_contract_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "agent_contract" ADD CONSTRAINT "agent_contract_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "pipeline_step" ADD COLUMN "agent_contract_id" TEXT;

-- AddForeignKey
ALTER TABLE "pipeline_step" ADD CONSTRAINT "pipeline_step_agent_contract_id_fkey" FOREIGN KEY ("agent_contract_id") REFERENCES "agent_contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
