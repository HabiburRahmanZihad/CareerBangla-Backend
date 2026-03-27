-- CreateTable
CREATE TABLE "subscription_reminder_log" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reminderInterval" TEXT NOT NULL,
    "scheduledMinutes" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_reminder_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_reminder_log_subscriptionId_reminderInterval_key" ON "subscription_reminder_log"("subscriptionId", "reminderInterval");

-- CreateIndex
CREATE INDEX "subscription_reminder_log_subscriptionId_idx" ON "subscription_reminder_log"("subscriptionId");

-- CreateIndex
CREATE INDEX "subscription_reminder_log_userId_idx" ON "subscription_reminder_log"("userId");

-- CreateIndex
CREATE INDEX "subscription_reminder_log_sentAt_idx" ON "subscription_reminder_log"("sentAt");

-- AddForeignKey
ALTER TABLE "subscription_reminder_log" ADD CONSTRAINT "subscription_reminder_log_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_reminder_log" ADD CONSTRAINT "subscription_reminder_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
