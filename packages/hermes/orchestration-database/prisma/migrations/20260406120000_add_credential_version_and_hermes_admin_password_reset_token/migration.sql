-- AlterTable
ALTER TABLE "user" ADD COLUMN "credential_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "hermes_admin_password_reset_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hermes_admin_password_reset_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hermes_admin_password_reset_token_token_hash_key" ON "hermes_admin_password_reset_token"("token_hash");

-- CreateIndex
CREATE INDEX "hermes_admin_password_reset_token_user_id_idx" ON "hermes_admin_password_reset_token"("user_id");

-- AddForeignKey
ALTER TABLE "hermes_admin_password_reset_token" ADD CONSTRAINT "hermes_admin_password_reset_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
