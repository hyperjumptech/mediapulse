-- CreateTable
CREATE TABLE "data_source_expansion_template" (
    "id" TEXT NOT NULL,
    "domain_integration_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expansion_string" TEXT NOT NULL,
    "description" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_source_expansion_template_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "data_source_expansion_template" ADD CONSTRAINT "data_source_expansion_template_domain_integration_id_fkey" FOREIGN KEY ("domain_integration_id") REFERENCES "domain_integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_source_expansion_template" ADD CONSTRAINT "data_source_expansion_template_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
