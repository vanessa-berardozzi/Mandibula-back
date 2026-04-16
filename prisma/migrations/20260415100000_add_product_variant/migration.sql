-- CreateTable product_variant
CREATE TABLE "product_variant" (
  "id"        TEXT          NOT NULL,
  "productId" TEXT          NOT NULL,
  "name"      TEXT          NOT NULL,
  "lotSize"   INTEGER       NOT NULL DEFAULT 1,
  "price"     DECIMAL(10,2) NOT NULL,
  "stock"     INTEGER       NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN       NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "product_variant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_variant_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "product_variant_productId_name_key"
  ON "product_variant"("productId", "name");

-- Migrate CartItem : remplacer productId par variantId
ALTER TABLE "cart_item"
  ADD COLUMN "variantId"   TEXT,
  ADD COLUMN "variantName" TEXT;

-- Supprimer l'ancienne contrainte unique et l'index
DROP INDEX IF EXISTS "cart_item_cartId_productId_key";
DROP INDEX IF EXISTS "cart_item_productId_idx";

-- Supprimer la FK existante sur productId
ALTER TABLE "cart_item" DROP CONSTRAINT IF EXISTS "cart_item_productId_fkey";

-- Supprimer la colonne productId
ALTER TABLE "cart_item" DROP COLUMN "productId";

-- Rendre variantId NOT NULL (la table est vide après le reset)
ALTER TABLE "cart_item" ALTER COLUMN "variantId" SET NOT NULL;

-- Ajouter FK + index
ALTER TABLE "cart_item"
  ADD CONSTRAINT "cart_item_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "product_variant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "cart_item_cartId_variantId_key" ON "cart_item"("cartId", "variantId");
CREATE INDEX "cart_item_variantId_idx" ON "cart_item"("variantId");

-- Migrate OrderItem : remplacer productId par variantId + variantName snapshot
ALTER TABLE "OrderItem"
  ADD COLUMN "variantId"   TEXT,
  ADD COLUMN "variantName" TEXT;

-- Supprimer FK existante sur productId
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_productId_fkey";
ALTER TABLE "OrderItem" DROP COLUMN "productId";

-- Rendre variantId NOT NULL (table vide)
ALTER TABLE "OrderItem" ALTER COLUMN "variantId"   SET NOT NULL;
ALTER TABLE "OrderItem" ALTER COLUMN "variantName" SET DEFAULT '';
ALTER TABLE "OrderItem" ALTER COLUMN "variantName" SET NOT NULL;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "product_variant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
