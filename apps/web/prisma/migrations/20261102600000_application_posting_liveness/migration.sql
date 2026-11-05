-- AlterTable
ALTER TABLE "Application" ADD COLUMN "postingOpen" BOOLEAN,
ADD COLUMN "postingCheckedAt" TIMESTAMP(3),
ADD COLUMN "postingCheckNote" TEXT NOT NULL DEFAULT '';
