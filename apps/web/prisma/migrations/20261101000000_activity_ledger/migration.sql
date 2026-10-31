-- CreateEnum
CREATE TYPE "ActivityActor" AS ENUM ('USER', 'SCHEDULER', 'CLI', 'MCP', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActivityOutcome" AS ENUM ('OK', 'ERROR');

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorKind" "ActivityActor" NOT NULL DEFAULT 'USER',
    "actorName" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT '',
    "targetId" TEXT,
    "applicationId" TEXT,
    "platform" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "outcome" "ActivityOutcome" NOT NULL DEFAULT 'OK',
    "summary" TEXT NOT NULL DEFAULT '',
    "data" JSONB,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityEvent_at_idx" ON "ActivityEvent"("at");

-- CreateIndex
CREATE INDEX "ActivityEvent_action_at_idx" ON "ActivityEvent"("action", "at");

-- CreateIndex
CREATE INDEX "ActivityEvent_applicationId_at_idx" ON "ActivityEvent"("applicationId", "at");

-- CreateIndex
CREATE INDEX "ActivityEvent_actorKind_at_idx" ON "ActivityEvent"("actorKind", "at");
