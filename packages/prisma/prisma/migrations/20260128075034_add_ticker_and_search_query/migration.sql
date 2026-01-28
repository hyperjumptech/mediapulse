-- CreateTable
CREATE TABLE "search_query" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_query_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticker" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticker_symbol_key" ON "ticker"("symbol");

-- AddForeignKey
ALTER TABLE "search_query" ADD CONSTRAINT "search_query_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
