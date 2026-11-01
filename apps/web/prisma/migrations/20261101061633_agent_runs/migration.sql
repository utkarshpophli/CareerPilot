-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'OK', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "ActivityEvent" ADD COLUMN     "runId" TEXT;

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "actorKind" "ActivityActor" NOT NULL DEFAULT 'CLI',
    "actorName" TEXT NOT NULL DEFAULT '',
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "lastStep" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "applicationId" TEXT,
    "idempotencyKey" TEXT,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentRun_idempotencyKey_key" ON "AgentRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AgentRun_startedAt_idx" ON "AgentRun"("startedAt");

-- CreateIndex
CREATE INDEX "AgentRun_status_startedAt_idx" ON "AgentRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_runId_at_idx" ON "ActivityEvent"("runId", "at");
