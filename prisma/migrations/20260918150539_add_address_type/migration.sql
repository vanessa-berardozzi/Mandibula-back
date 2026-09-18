-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('SHIPPING', 'BILLING', 'BOTH');

-- AlterTable
ALTER TABLE "Adress" ADD COLUMN     "type" "AddressType" NOT NULL DEFAULT 'BOTH';
