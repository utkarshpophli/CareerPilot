-- AlterTable
ALTER TABLE "ScannedPosting" ADD COLUMN     "trustFlags" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "trustScore" INTEGER;
