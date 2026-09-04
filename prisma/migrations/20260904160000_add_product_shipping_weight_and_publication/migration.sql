-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "shippingWeight" DECIMAL(10,2),
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT true;
