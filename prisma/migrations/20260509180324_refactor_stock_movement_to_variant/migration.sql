/*
  Warnings:

  - You are about to drop the column `quantity` on the `StockInfo` table. All the data in the column will be lost.
  - You are about to drop the column `stockId` on the `StockMovement` table. All the data in the column will be lost.
  - Added the required column `productId` to the `StockMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `variantId` to the `StockMovement` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_stockId_fkey";

-- AlterTable
ALTER TABLE "StockInfo" DROP COLUMN "quantity";

-- AlterTable
ALTER TABLE "StockMovement" DROP COLUMN "stockId",
ADD COLUMN     "productId" TEXT NOT NULL,
ADD COLUMN     "variantId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
