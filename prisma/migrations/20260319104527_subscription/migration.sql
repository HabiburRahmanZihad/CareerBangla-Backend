/*
  Warnings:

  - The values [STARTER,PROFESSIONAL,ENTERPRISE] on the enum `SubscriptionPlan` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `coins` on the `coupon` table. All the data in the column will be lost.
  - You are about to drop the column `coins` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `stripeEventId` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the `coin_transaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `gift_voucher` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wallet` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[val_id]` on the table `subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[referralCode]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionPlan_new" AS ENUM ('FREE', 'MONTHLY', 'QUARTERLY', 'BIANNUAL', 'YEARLY');
ALTER TABLE "public"."subscription" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "subscription" ALTER COLUMN "plan" TYPE "SubscriptionPlan_new" USING ("plan"::text::"SubscriptionPlan_new");
ALTER TYPE "SubscriptionPlan" RENAME TO "SubscriptionPlan_old";
ALTER TYPE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";
DROP TYPE "public"."SubscriptionPlan_old";
ALTER TABLE "subscription" ALTER COLUMN "plan" SET DEFAULT 'FREE';
COMMIT;

-- DropForeignKey
ALTER TABLE "coin_transaction" DROP CONSTRAINT "coin_transaction_walletId_fkey";

-- DropForeignKey
ALTER TABLE "wallet" DROP CONSTRAINT "wallet_userId_fkey";

-- DropIndex
DROP INDEX "subscription_stripeEventId_key";

-- AlterTable
ALTER TABLE "coupon" DROP COLUMN "coins",
ADD COLUMN     "discountAmount" DOUBLE PRECISION,
ADD COLUMN     "discountPercent" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "subscription" DROP COLUMN "coins",
DROP COLUMN "stripeEventId",
ADD COLUMN     "bank_tran_id" TEXT,
ADD COLUMN     "card_type" TEXT,
ADD COLUMN     "couponId" TEXT,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN     "referralId" TEXT,
ADD COLUMN     "store_amount" DOUBLE PRECISION,
ADD COLUMN     "val_id" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "isPremium" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "premiumUntil" TIMESTAMP(3),
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredBy" TEXT;

-- DropTable
DROP TABLE "coin_transaction";

-- DropTable
DROP TABLE "gift_voucher";

-- DropTable
DROP TABLE "wallet";

-- DropEnum
DROP TYPE "TransactionPurpose";

-- DropEnum
DROP TYPE "TransactionType";

-- CreateTable
CREATE TABLE "referral_history" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "hasPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_history_referredUserId_key" ON "referral_history"("referredUserId");

-- CreateIndex
CREATE INDEX "referral_history_referrerId_idx" ON "referral_history"("referrerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_val_id_key" ON "subscription"("val_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_referralCode_key" ON "user"("referralCode");

-- AddForeignKey
ALTER TABLE "referral_history" ADD CONSTRAINT "referral_history_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_history" ADD CONSTRAINT "referral_history_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
