-- CreateTable
CREATE TABLE "AiCall" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "actorKind" "ActivityActor" NOT NULL DEFAULT 'USER',
    "actorName" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AiCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiCall_at_idx" ON "AiCall"("at");

-- CreateIndex
CREATE INDEX "AiCall_model_at_idx" ON "AiCall"("model", "at");
