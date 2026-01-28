-- CreateTable
CREATE TABLE "agent_registry" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "agent_version" TEXT NOT NULL,
    "description" TEXT,
    "endpoint" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_registry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_registry_agent_id_agent_version_key" ON "agent_registry"("agent_id", "agent_version");
