-- CreateEnum
CREATE TYPE "ScannedState" AS ENUM ('NEW', 'SAVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ScannedPosting" (
    "id" TEXT NOT NULL,
    "source" "BoardSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "companyId" TEXT,
    "companyName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "remote" BOOLEAN,
    "url" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "postedAt" TIMESTAMP(3),
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT '',
    "urlKey" TEXT NOT NULL DEFAULT '',
    "canonicalKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "duplicateOfId" TEXT,
    "guardAlarm" BOOLEAN NOT NULL DEFAULT false,
    "guardNote" TEXT NOT NULL DEFAULT '',
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "state" "ScannedState" NOT NULL DEFAULT 'NEW',
    "score" INTEGER,
    "scoreBand" TEXT NOT NULL DEFAULT '',
    "scoreReasons" JSONB NOT NULL DEFAULT '[]',
    "scoreRedFlags" JSONB NOT NULL DEFAULT '[]',
    "scoredWith" TEXT NOT NULL DEFAULT '',
    "scoredAt" TIMESTAMP(3),

    CONSTRAINT "ScannedPosting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScannedPosting_state_closedAt_score_idx" ON "ScannedPosting"("state", "closedAt", "score");

-- CreateIndex
CREATE INDEX "ScannedPosting_canonicalKey_idx" ON "ScannedPosting"("canonicalKey");

-- CreateIndex
CREATE INDEX "ScannedPosting_urlKey_idx" ON "ScannedPosting"("urlKey");

-- CreateIndex
CREATE INDEX "ScannedPosting_companyId_closedAt_idx" ON "ScannedPosting"("companyId", "closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScannedPosting_source_externalId_key" ON "ScannedPosting"("source", "externalId");

-- AddForeignKey
ALTER TABLE "ScannedPosting" ADD CONSTRAINT "ScannedPosting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TrackedCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
