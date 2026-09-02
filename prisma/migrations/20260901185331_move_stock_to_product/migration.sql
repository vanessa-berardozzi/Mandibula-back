/*
  Warnings:

  - You are about to drop the column `reservedStock` on the `product_variant` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `product_variant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "totalStock" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "product_variant" DROP COLUMN "reservedStock",
DROP COLUMN "stock";
