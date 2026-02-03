/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `agent_instance` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "agent_instance_id_key" ON "agent_instance"("id");
