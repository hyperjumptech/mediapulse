-- CreateTable
CREATE TABLE "variable" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "note" TEXT,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "variable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "variable_key_key" ON "variable"("key");

-- AddForeignKey
ALTER TABLE "variable" ADD CONSTRAINT "variable_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
