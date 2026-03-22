-- DropIndex
DROP INDEX "agent_registry_agent_id_agent_version_key";

-- CreateIndex
CREATE UNIQUE INDEX "agent_registry_domain_integration_id_agent_id_agent_version_key" ON "agent_registry"("domain_integration_id", "agent_id", "agent_version");
