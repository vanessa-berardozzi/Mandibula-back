/*
  Warnings:

  - A unique constraint covering the columns `[variantId]` on the table `StockInfo` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StockMode" AS ENUM ('SHARED_POOL', 'PER_VARIANT');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "stockMode" "StockMode" NOT NULL DEFAULT 'SHARED_POOL';

-- AlterTable
ALTER TABLE "StockInfo" ADD COLUMN     "variantId" TEXT,
ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "cartId" TEXT;

-- AlterTable
ALTER TABLE "product_variant" ADD COLUMN     "reservedStock" INTEGER,
ADD COLUMN     "totalStock" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "StockInfo_variantId_key" ON "StockInfo"("variantId");

-- CreateIndex
CREATE INDEX "StockMovement_cartId_idx" ON "StockMovement"("cartId");

-- AddForeignKey
ALTER TABLE "StockInfo" ADD CONSTRAINT "StockInfo_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
