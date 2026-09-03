/*
  Warnings:

  - Made the column `type` on table `StockMovement` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lastConnection` on table `user` required. This step will fail if there are existing NULL values in that column.

*/
-- UpdateTable: Fix NULL values before making columns required
UPDATE "user" SET "lastConnection" = CURRENT_TIMESTAMP WHERE "lastConnection" IS NULL;
UPDATE "StockMovement" SET "type" = 'ADJUSTMENT' WHERE "type" IS NULL;

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('NONE', 'PERCENTAGE', 'FIXED_AMOUNT');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promotionType" "PromotionType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "promotionValue" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "StockMovement" ALTER COLUMN "type" SET NOT NULL;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "lastConnection" SET NOT NULL,
ALTER COLUMN "lastConnection" SET DEFAULT CURRENT_TIMESTAMP;
