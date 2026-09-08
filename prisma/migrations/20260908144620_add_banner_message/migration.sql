-- CreateTable
CREATE TABLE "site_banner" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "message" VARCHAR(300) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_banner_pkey" PRIMARY KEY ("id")
);
