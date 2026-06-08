-- CreateEnum
CREATE TYPE "SegmentCampaignType" AS ENUM ('EMAIL', 'SMS', 'BOTH');

-- AlterTable
ALTER TABLE "Segment" ADD COLUMN     "campaignType" "SegmentCampaignType" NOT NULL DEFAULT 'BOTH';
