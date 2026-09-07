-- Track the promotion used by an order and allow promotions without a start date.
ALTER TABLE "Order" ADD COLUMN "promotionId" TEXT;

ALTER TABLE "promotions" ALTER COLUMN "startsAt" DROP NOT NULL;

CREATE INDEX "Order_promotionId_idx" ON "Order"("promotionId");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_promotionId_fkey"
FOREIGN KEY ("promotionId") REFERENCES "promotions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;