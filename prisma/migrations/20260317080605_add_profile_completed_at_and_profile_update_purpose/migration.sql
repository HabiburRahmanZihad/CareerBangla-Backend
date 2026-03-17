-- AlterEnum
ALTER TYPE "TransactionPurpose" ADD VALUE 'PROFILE_UPDATE';

-- AlterTable
ALTER TABLE "coupon" ADD COLUMN     "maxUsage" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "gift_voucher" ADD COLUMN     "maxUsage" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "resume" ADD COLUMN     "profileCompletedAt" TIMESTAMP(3);
