-- CreateIndex
CREATE INDEX "application_createdAt_idx" ON "application"("createdAt");

-- CreateIndex
CREATE INDEX "application_jobId_createdAt_idx" ON "application"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_job_createdAt" ON "job"("createdAt");

-- CreateIndex
CREATE INDEX "idx_job_active" ON "job"("isDeleted", "status");

-- CreateIndex
CREATE INDEX "idx_job_recruiter_active" ON "job"("recruiterId", "isDeleted");

-- CreateIndex
CREATE INDEX "notification_userId_isRead_idx" ON "notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notification_createdAt_idx" ON "notification"("createdAt");

-- CreateIndex
CREATE INDEX "referral_history_referrerId_hasPaid_idx" ON "referral_history"("referrerId", "hasPaid");

-- CreateIndex
CREATE INDEX "subscription_userId_status_idx" ON "subscription"("userId", "status");

-- CreateIndex
CREATE INDEX "subscription_createdAt_idx" ON "subscription"("createdAt");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE INDEX "user_status_idx" ON "user"("status");

-- CreateIndex
CREATE INDEX "user_isDeleted_idx" ON "user"("isDeleted");

-- CreateIndex
CREATE INDEX "user_referredBy_idx" ON "user"("referredBy");

-- CreateIndex
CREATE INDEX "user_isPremium_idx" ON "user"("isPremium");

-- CreateIndex
CREATE INDEX "user_createdAt_idx" ON "user"("createdAt");
