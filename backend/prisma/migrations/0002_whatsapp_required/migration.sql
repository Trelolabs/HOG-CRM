-- Backfill missing mobile numbers before enforcing NOT NULL
UPDATE "Lead" SET "whatsapp" = 'UNKNOWN' WHERE "whatsapp" IS NULL;

-- AlterTable
ALTER TABLE "Lead" ALTER COLUMN "whatsapp" SET NOT NULL;
