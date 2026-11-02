-- CreateEnum
CREATE TYPE "BoardSource" AS ENUM ('GREENHOUSE', 'LEVER', 'ASHBY');

-- CreateTable
CREATE TABLE "TrackedCompany" (
    "id" TEXT NOT NULL,
    "source" "BoardSource" NOT NULL,
    "slug" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScanAt" TIMESTAMP(3),
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "lastFound" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrackedCompany_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackedCompany_enabled_name_idx" ON "TrackedCompany"("enabled", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedCompany_source_slug_region_key" ON "TrackedCompany"("source", "slug", "region");
