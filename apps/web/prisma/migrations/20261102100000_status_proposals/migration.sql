-- CreateEnum
CREATE TYPE "ProposalState" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "StatusProposal" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actorKind" "ActivityActor" NOT NULL DEFAULT 'CLI',
    "actorName" TEXT NOT NULL DEFAULT '',
    "state" "ProposalState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "statusEventId" TEXT,

    CONSTRAINT "StatusProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatusProposal_state_createdAt_idx" ON "StatusProposal"("state", "createdAt");

-- CreateIndex
CREATE INDEX "StatusProposal_applicationId_state_idx" ON "StatusProposal"("applicationId", "state");

-- AddForeignKey
ALTER TABLE "StatusProposal" ADD CONSTRAINT "StatusProposal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
