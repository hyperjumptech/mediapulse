-- CreateTable
CREATE TABLE "data_source_expansion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expansion_string" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "data_source_expansion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "data_source_expansion" ADD CONSTRAINT "data_source_expansion_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
