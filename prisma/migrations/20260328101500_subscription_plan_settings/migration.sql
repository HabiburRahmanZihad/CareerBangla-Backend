-- CreateTable
CREATE TABLE "subscription_plan_setting" (
    "id" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "durationDays" INTEGER,
    "features" JSONB NOT NULL,
    "recruiterOnly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plan_setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plan_setting_planKey_key" ON "subscription_plan_setting"("planKey");

-- CreateIndex
CREATE INDEX "subscription_plan_setting_planKey_idx" ON "subscription_plan_setting"("planKey");

-- CreateIndex
CREATE INDEX "subscription_plan_setting_recruiterOnly_idx" ON "subscription_plan_setting"("recruiterOnly");
