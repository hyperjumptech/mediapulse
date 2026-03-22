-- CreateTable
CREATE TABLE "mediapulse_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mediapulse_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mediapulse_user_email_key" ON "mediapulse_user"("email");

-- AddForeignKey
ALTER TABLE "user_ticker" ADD CONSTRAINT "user_ticker_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "mediapulse_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
