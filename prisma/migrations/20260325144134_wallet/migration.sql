-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "TransactionPurpose" AS ENUM ('APPLY_JOB', 'VIEW_RECRUITER_EMAIL', 'POST_JOB', 'VIEW_CANDIDATE', 'PROFILE_UPDATE', 'SUBSCRIPTION_PURCHASE', 'COUPON_REDEEM', 'GIFT_VOUCHER_REDEEM', 'ADMIN_ADJUSTMENT');

-- CreateTable
CREATE TABLE "wallet" (
    "id" TEXT NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 50,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_transaction" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "purpose" "TransactionPurpose" NOT NULL,
    "amount" INTEGER NOT NULL,
    "message" TEXT,
    "walletId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_userId_key" ON "wallet"("userId");

-- CreateIndex
CREATE INDEX "wallet_userId_idx" ON "wallet"("userId");

-- CreateIndex
CREATE INDEX "coin_transaction_walletId_idx" ON "coin_transaction"("walletId");

-- CreateIndex
CREATE INDEX "coin_transaction_createdAt_idx" ON "coin_transaction"("createdAt");

-- CreateIndex
CREATE INDEX "coin_transaction_purpose_idx" ON "coin_transaction"("purpose");

-- AddForeignKey
ALTER TABLE "wallet" ADD CONSTRAINT "wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transaction" ADD CONSTRAINT "coin_transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
