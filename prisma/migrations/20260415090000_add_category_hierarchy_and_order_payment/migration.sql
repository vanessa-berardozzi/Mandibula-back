-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- AlterTable Category : ajout de la hiérarchie parent/enfant
ALTER TABLE "Category" ADD COLUMN "parentId" TEXT;

ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Category"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable Order : ajout des champs SumUp, frais de port, notes, paymentStatus
ALTER TABLE "Order"
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "sumupCheckoutId" TEXT,
  ADD COLUMN "subtotal"        DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "shippingCost"    DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "notes"           TEXT;

-- Renseigner subtotal = total pour les commandes existantes (rétrocompat)
UPDATE "Order" SET "subtotal" = "total";

-- Contrainte d'unicité sur la référence SumUp
CREATE UNIQUE INDEX "Order_sumupCheckoutId_key" ON "Order"("sumupCheckoutId");
