-- CreateTable
CREATE TABLE "guides" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "readingTime" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "recapSummary" TEXT,
    "recapPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_sections" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "paragraphs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bullets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "warning" TEXT,

    CONSTRAINT "guide_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_sources" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,

    CONSTRAINT "guide_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_facts" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "guide_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_visuals" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "src" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "caption" TEXT,

    CONSTRAINT "guide_visuals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guides_slug_key" ON "guides"("slug");

-- CreateIndex
CREATE INDEX "guides_isPublished_position_idx" ON "guides"("isPublished", "position");

-- CreateIndex
CREATE INDEX "guides_category_idx" ON "guides"("category");

-- CreateIndex
CREATE UNIQUE INDEX "guide_sections_guideId_position_key" ON "guide_sections"("guideId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "guide_sources_guideId_position_key" ON "guide_sources"("guideId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "guide_facts_guideId_position_key" ON "guide_facts"("guideId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "guide_visuals_guideId_position_key" ON "guide_visuals"("guideId", "position");

-- AddForeignKey
ALTER TABLE "guide_sections" ADD CONSTRAINT "guide_sections_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_sources" ADD CONSTRAINT "guide_sources_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_facts" ADD CONSTRAINT "guide_facts_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_visuals" ADD CONSTRAINT "guide_visuals_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
