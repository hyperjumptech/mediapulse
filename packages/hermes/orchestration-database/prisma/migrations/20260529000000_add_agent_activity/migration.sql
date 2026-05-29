-- CreateTable
CREATE TABLE "agent_activity" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_activity_job_id_idx" ON "agent_activity"("job_id");
