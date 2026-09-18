-- DropIndex
DROP INDEX "knowledge_entity_kind_normalized_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_entity_normalized_name_key" ON "knowledge_entity"("normalized_name");

