-- CreateTable
CREATE TABLE "user_ticker" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ticker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_ticker_user_id_ticker_id_key" ON "user_ticker"("user_id", "ticker_id");

-- AddForeignKey
ALTER TABLE "user_ticker" ADD CONSTRAINT "user_ticker_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ticker" ADD CONSTRAINT "user_ticker_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
