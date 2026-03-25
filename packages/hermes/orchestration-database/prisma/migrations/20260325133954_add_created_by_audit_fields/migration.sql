-- AlterTable
ALTER TABLE "agent_config" ADD COLUMN     "created_by_id" TEXT;

-- AlterTable
ALTER TABLE "http_trigger" ADD COLUMN     "created_by_id" TEXT;

-- AlterTable
ALTER TABLE "pipeline" ADD COLUMN     "created_by_id" TEXT;

-- AlterTable
ALTER TABLE "pipeline_step" ADD COLUMN     "created_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "agent_config" ADD CONSTRAINT "agent_config_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline" ADD CONSTRAINT "pipeline_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "http_trigger" ADD CONSTRAINT "http_trigger_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_step" ADD CONSTRAINT "pipeline_step_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
