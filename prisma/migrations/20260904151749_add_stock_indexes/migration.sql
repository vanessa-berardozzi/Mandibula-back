-- CreateIndex
CREATE INDEX "Order_userId_paymentStatus_idx" ON "Order"("userId", "paymentStatus");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_type_idx" ON "StockMovement"("productId", "type");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");
