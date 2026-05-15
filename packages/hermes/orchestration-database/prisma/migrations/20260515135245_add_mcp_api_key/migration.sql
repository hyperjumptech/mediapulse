-- CreateTable
CREATE TABLE "mcp_api_key" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "read_only" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" TEXT NOT NULL,
    "owner_credential_version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_user_id" TEXT,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "mcp_api_key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_api_key_key_hash_key" ON "mcp_api_key"("key_hash");

-- CreateIndex
CREATE INDEX "mcp_api_key_created_by_user_id_idx" ON "mcp_api_key"("created_by_user_id");

-- AddForeignKey
ALTER TABLE "mcp_api_key" ADD CONSTRAINT "mcp_api_key_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_api_key" ADD CONSTRAINT "mcp_api_key_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
