-- CreateEnum
CREATE TYPE "ProductVatCategory" AS ENUM ('STANDARD_GOODS', 'LIVE_ANIMALS');

-- CreateEnum
CREATE TYPE "VatRateType" AS ENUM ('STANDARD', 'REDUCED', 'SUPER_REDUCED', 'ZERO');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "vatCategory" "ProductVatCategory" NOT NULL DEFAULT 'STANDARD_GOODS';

-- CreateTable
CREATE TABLE "countries" (
    "code" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "isEuMember" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "vat_rates" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "productCategory" "ProductVatCategory" NOT NULL,
    "rateType" "VatRateType" NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vat_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vat_number_checks" (
    "id" TEXT NOT NULL,
    "vatNumber" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "isValid" BOOLEAN NOT NULL,
    "companyName" TEXT,
    "consultationId" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vat_number_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vat_rates_countryCode_productCategory_idx" ON "vat_rates"("countryCode", "productCategory");

-- CreateIndex
CREATE UNIQUE INDEX "vat_rates_countryCode_productCategory_validFrom_key" ON "vat_rates"("countryCode", "productCategory", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "vat_number_checks_vatNumber_key" ON "vat_number_checks"("vatNumber");

-- CreateIndex
CREATE INDEX "vat_number_checks_vatNumber_idx" ON "vat_number_checks"("vatNumber");

-- AddForeignKey
ALTER TABLE "vat_rates" ADD CONSTRAINT "vat_rates_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
