/*
  Warnings:

  - You are about to drop the column `usedAt` on the `coupon` table. All the data in the column will be lost.
  - You are about to drop the column `usedBy` on the `coupon` table. All the data in the column will be lost.
  - Added the required column `type` to the `coupon` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('FREE_DAYS', 'LIFETIME_FREE', 'PERCENT_DISCOUNT', 'AMOUNT_DISCOUNT', 'RECRUITER_DAYS', 'RECRUITER_MONTHS', 'REFERRAL');

-- CreateEnum
CREATE TYPE "CouponTargetRole" AS ENUM ('USER', 'RECRUITER', 'BOTH');

-- AlterTable
ALTER TABLE "coupon" DROP COLUMN "usedAt",
DROP COLUMN "usedBy",
ADD COLUMN     "commissionAmount" DOUBLE PRECISION,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "freeDays" INTEGER,
ADD COLUMN     "freeMonths" INTEGER,
ADD COLUMN     "isLifetime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linkedRecruiterId" TEXT,
ADD COLUMN     "targetRole" "CouponTargetRole" NOT NULL DEFAULT 'USER',
ADD COLUMN     "type" "CouponType" NOT NULL;

-- CreateTable
CREATE TABLE "coupon_usage" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coupon_usage_couponId_idx" ON "coupon_usage"("couponId");

-- CreateIndex
CREATE INDEX "coupon_usage_userId_idx" ON "coupon_usage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_usage_couponId_userId_key" ON "coupon_usage"("couponId", "userId");

-- CreateIndex
CREATE INDEX "coupon_type_idx" ON "coupon"("type");

-- AddForeignKey
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
