-- Who made a version, and a cause for edits by hand (M7.2).
ALTER TYPE "VersionCause" ADD VALUE 'EDITED';

CREATE TYPE "VersionActor" AS ENUM ('YOU', 'APP_AI', 'ASSISTANT');

ALTER TABLE "DocumentVersion" ADD COLUMN "actor" "VersionActor" NOT NULL DEFAULT 'APP_AI';

-- Versions made before this column: the owner's own acts, and the first drafts an assistant wrote.
UPDATE "DocumentVersion" SET "actor" = 'YOU' WHERE "cause" IN ('UNDONE', 'BEFORE_RESTORE', 'RESTORED', 'CLEANED');
UPDATE "DocumentVersion" AS v SET "actor" = 'ASSISTANT'
  FROM "Document" AS d
  WHERE v."documentId" = d."id" AND v."cause" = 'WRITTEN' AND d."writtenWith" = 'claude-chat';
