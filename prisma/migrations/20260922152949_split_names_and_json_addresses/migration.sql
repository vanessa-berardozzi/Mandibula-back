/*
  Warnings:

  - The `billingAddress` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `shippingAddress` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Adress` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `buyerAddress` to the `invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `buyerName` to the `invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vatDetailsJson` to the `invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vatRegime` to the `invoice` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Adress" DROP CONSTRAINT "Adress_userId_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "billingAddress",
ADD COLUMN     "billingAddress" JSONB,
DROP COLUMN "shippingAddress",
ADD COLUMN     "shippingAddress" JSONB;

-- AlterTable
ALTER TABLE "invoice" ADD COLUMN     "buyerAddress" JSONB NOT NULL,
ADD COLUMN     "buyerName" TEXT NOT NULL,
ADD COLUMN     "buyerVatNumber" TEXT,
ADD COLUMN     "vatDetailsJson" JSONB NOT NULL,
ADD COLUMN     "vatRegime" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;

-- DropTable
DROP TABLE "Adress";

-- CreateTable
CREATE TABLE "adress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "companyName" TEXT,
    "vatNumber" TEXT,
    "phone" TEXT,
    "type" "AddressType" NOT NULL DEFAULT 'BOTH',
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adress_userId_idx" ON "adress"("userId");

-- AddForeignKey
ALTER TABLE "adress" ADD CONSTRAINT "adress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
