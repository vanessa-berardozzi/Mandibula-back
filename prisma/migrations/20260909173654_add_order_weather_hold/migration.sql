-- CreateTable
CREATE TABLE "order_weather_hold" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "previousStatus" "OrderStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "order_weather_hold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_weather_hold_orderId_key" ON "order_weather_hold"("orderId");

-- CreateIndex
CREATE INDEX "order_weather_hold_releasedAt_idx" ON "order_weather_hold"("releasedAt");

-- AddForeignKey
ALTER TABLE "order_weather_hold" ADD CONSTRAINT "order_weather_hold_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
