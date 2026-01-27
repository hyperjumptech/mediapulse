-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNHEALTHY', 'SPAWNING');

-- CreateTable
CREATE TABLE "agent_instance" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "agent_version" TEXT NOT NULL,
    "endpoint" JSONB NOT NULL,
    "status" "InstanceStatus" NOT NULL DEFAULT 'SPAWNING',
    "capacity" INTEGER NOT NULL,
    "current_load" INTEGER NOT NULL DEFAULT 0,
    "last_heartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_instance_pkey" PRIMARY KEY ("id")
);
