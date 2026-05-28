/*
  Warnings:

  - A unique constraint covering the columns `[guestToken]` on the table `cart` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "cart" ADD COLUMN     "guestToken" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "cart_guestToken_key" ON "cart"("guestToken");

-- CreateIndex
CREATE INDEX "cart_guestToken_idx" ON "cart"("guestToken");
