-- First, drop the default from the column
ALTER TABLE "Segment" ALTER COLUMN "campaignType" DROP DEFAULT;

-- Update any BOTH segments to EMAIL (safe default)
UPDATE "Segment" SET "campaignType" = 'EMAIL' WHERE "campaignType" = 'BOTH';

-- AlterEnum - Remove BOTH from SegmentCampaignType
ALTER TYPE "SegmentCampaignType" RENAME TO "SegmentCampaignType_old";
CREATE TYPE "SegmentCampaignType" AS ENUM ('EMAIL', 'SMS');
ALTER TABLE "Segment" ALTER COLUMN "campaignType" TYPE "SegmentCampaignType" USING "campaignType"::text::"SegmentCampaignType";
DROP TYPE "SegmentCampaignType_old";
