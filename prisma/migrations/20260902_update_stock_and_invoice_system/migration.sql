-- CreateEnum for StockMovementType
CREATE TYPE "StockMovementType" AS ENUM ('ENTRY', 'SALE', 'RESERVATION', 'RESERVATION_RELEASE', 'LOSS', 'ADJUSTMENT', 'RETURN');

-- Add reservedStock to Product if not exists
ALTER TABLE "Product" ADD COLUMN "reservedStock" INTEGER NOT NULL DEFAULT 0;

-- Update StockMovement table: add new columns first
ALTER TABLE "StockMovement" ADD COLUMN "type_new" "StockMovementType";
ALTER TABLE "StockMovement" ADD COLUMN "orderId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "unitCost" DECIMAL(10,2);

-- Map existing string values to enum values
-- Default: map "IN" to "ENTRY", "OUT" to "SALE", etc.
UPDATE "StockMovement" 
SET "type_new" = CASE 
  WHEN "type" = 'IN' THEN 'ENTRY'::"StockMovementType"
  WHEN "type" = 'OUT' THEN 'SALE'::"StockMovementType"
  WHEN "type" = 'ADJUSTMENT' THEN 'ADJUSTMENT'::"StockMovementType"
  WHEN "type" = 'LOSS' THEN 'LOSS'::"StockMovementType"
  WHEN "type" = 'RETURN' THEN 'RETURN'::"StockMovementType"
  ELSE 'ENTRY'::"StockMovementType"
END;

-- Drop old type column and rename new one
ALTER TABLE "StockMovement" DROP COLUMN "type";
ALTER TABLE "StockMovement" RENAME COLUMN "type_new" TO "type";

-- Add foreign key and indexes
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

-- Add fields to Order
ALTER TABLE "Order" ADD COLUMN "reservationExpiresAt" TIMESTAMP(3);

-- Create Invoice table
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalHT" DECIMAL(10,2) NOT NULL,
    "totalVAT" DECIMAL(10,2) NOT NULL,
    "totalTTC" DECIMAL(10,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "pdfUrl" TEXT,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- Add unique constraints for Invoice
CREATE UNIQUE INDEX "invoice_orderId_key" ON "invoice"("orderId");
CREATE UNIQUE INDEX "invoice_invoiceNumber_key" ON "invoice"("invoiceNumber");

-- Add foreign key for Invoice
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create the invoice sequence for automatic numbering (PostgreSQL)
CREATE SEQUENCE invoice_seq START 1 INCREMENT 1;
