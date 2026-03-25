/*
  Warnings:

  - The values [COIN_CREDITED,COIN_DEBITED] on the enum `NotificationType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `coin_transaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wallet` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('APPLICATION_SUBMITTED', 'APPLICATION_SHORTLISTED', 'APPLICATION_INTERVIEW', 'APPLICATION_HIRED', 'APPLICATION_REJECTED', 'RECRUITER_APPROVED', 'RECRUITER_REJECTED', 'JOB_POSTED', 'GENERAL', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_EXPIRING_SOON');
ALTER TABLE "public"."notification" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
ALTER TABLE "notification" ALTER COLUMN "type" SET DEFAULT 'GENERAL';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubscriptionPlan" ADD VALUE 'RECRUITER_MONTHLY';
ALTER TYPE "SubscriptionPlan" ADD VALUE 'RECRUITER_6_MONTHS';
ALTER TYPE "SubscriptionPlan" ADD VALUE 'RECRUITER_YEARLY';

-- DropForeignKey
ALTER TABLE "coin_transaction" DROP CONSTRAINT "coin_transaction_walletId_fkey";

-- DropForeignKey
ALTER TABLE "wallet" DROP CONSTRAINT "wallet_userId_fkey";

-- AlterTable
ALTER TABLE "subscription" ADD COLUMN     "isRecruiterSubscription" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "coin_transaction";

-- DropTable
DROP TABLE "wallet";

-- DropEnum
DROP TYPE "TransactionPurpose";

-- DropEnum
DROP TYPE "TransactionType";

-- CreateIndex
CREATE INDEX "subscription_isRecruiterSubscription_idx" ON "subscription"("isRecruiterSubscription");
