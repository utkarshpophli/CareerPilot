-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "beatAt" TIMESTAMP(3) NOT NULL,
    "version" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);
