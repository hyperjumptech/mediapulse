-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('active', 'inactive', 'unhealthy');

-- CreateTable
CREATE TABLE "agent_instance" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "agent_version" TEXT NOT NULL,
    "endpoint" JSONB NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'active',
    "capacity" INTEGER NOT NULL,
    "current_load" INTEGER NOT NULL,
    "last_heartbeat" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_instance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_instance_instance_id_key" ON "agent_instance"("instance_id");
